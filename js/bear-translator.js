class BearTranslator {
    static #dictionary = {
        cn: {
            single: new Map(),
            phrases: new Map(),
            maxLength: 1
        },
        bear: new Map(),
        loaded: false
    };

    static #config = {
        bitLength: 20,
        separator: '·',
        base4Map: new Map([
            ['00', '啊'], ['01', '哒'],
            ['10', '.'], ['11', '。']
        ]),
        reverseBase4Map: new Map([
            ['啊', '00'], ['哒', '01'],
            ['.', '10'], ['。', '11']
        ])
    };

    static async init() {
        try {
            await this.#loadDictionary();
            this.#updateStatus('✅ 词库加载完成');
            this.#dictionary.loaded = true;
        } catch (e) {
            this.#updateStatus('⚠️ 词库加载失败，仅使用编码转换');
            this.#resetDictionary();
        }
    }

    static async #loadDictionary() {
        const response = await fetch('./dictionary.json');
        const data = await response.json();
        
        this.#resetDictionary();
        Object.entries(data.main).forEach(([key, value]) => {
            if (key === "了") return;

            // 跳过重复的键值对
            if (this.#dictionary.cn.single.has(key) || 
                (this.#dictionary.cn.phrases.get(key.length)?.has(key))) {
                console.warn(`跳过重复的词典条目: ${key}`);
                return;
            }

            if (key.length === 1) {
                this.#dictionary.cn.single.set(key, value);
            } else {
                const len = key.length;
                if (!this.#dictionary.cn.phrases.has(len)) {
                    this.#dictionary.cn.phrases.set(len, new Map());
                }
                this.#dictionary.cn.phrases.get(len).set(key, value);
                this.#dictionary.cn.maxLength = Math.max(this.#dictionary.cn.maxLength, len);
            }
            // 确保熊语到中文的映射唯一
            if (!this.#dictionary.bear.has(value)) {
                this.#dictionary.bear.set(value, key);
            } else {
                console.warn(`熊语值 ${value} 已存在映射，跳过重复定义`);
            }
        });
    }

    static #resetDictionary() {
        this.#dictionary.cn.single.clear();
        this.#dictionary.cn.phrases.clear();
        this.#dictionary.bear.clear();
        this.#dictionary.cn.maxLength = 1;
    }

    static convert(text, mode) {
        const realMode = mode === 'auto' ? 
            this.#detectLanguage(text) : mode;
        
        return realMode === 'cn2bear' ? 
            this.#encodeChinese(text) : 
            this.#decodeBear(text);
    }

    static #detectLanguage(text) {
        const cnChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
        const bearTokens = text.match(/[哒啊·~.]/g)?.length || 0;
        return cnChars > bearTokens ? 'cn2bear' : 'bear2cn';
    }

    static #encodeChinese(text) {
        const result = [];
        let pos = 0;
        const totalLen = text.length;

        while (pos < totalLen) {
            const currentChar = text[pos];
            if (currentChar === "了") {
                pos++;
                continue;
            }

            let matched = false;
            const maxCheck = Math.min(
                this.#dictionary.cn.maxLength,
                totalLen - pos
            );

            for (let checkLen = maxCheck; checkLen >= 1; checkLen--) {
                const candidate = text.substr(pos, checkLen);
                const dictMap = checkLen === 1 ? 
                    this.#dictionary.cn.single : 
                    (this.#dictionary.cn.phrases.get(checkLen) || new Map());

                if (dictMap.has(candidate)) {
                    result.push({
                        text: dictMap.get(candidate),
                        type: 'dict'
                    });
                    pos += checkLen;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                result.push({
                    text: this.#encodeBinary(text[pos]),
                    type: 'encode'
                });
                pos++;
            }
        }
        
        return {
            displayText: result.map(r => r.text).join(''),
            details: result
        };
    }

    static #encodeBinary(char) {
        const codePoint = char.codePointAt(0);
        const binStr = codePoint.toString(2)
            .padStart(this.#config.bitLength, '0');
        
        let encoded = '';
        for(let i=0; i<binStr.length; i+=2) {
            const pair = binStr.substr(i, 2);
            encoded += this.#config.base4Map.get(pair) || '??';
        }
        // 移除末尾的分隔符，避免解码时分割错误
        return encoded;
    }

    static #decodeBear(text) {
        // 保留原始文本中的分隔符作为分割依据
        const tokens = text.split(this.#config.separator);
        const result = [];

        for (const token of tokens) {
            if (!token) continue; // 跳过空字符串
            
            // 先尝试完整匹配整个token
            if (this.#dictionary.bear.has(token)) {
                result.push({
                    text: this.#dictionary.bear.get(token),
                    type: 'dict'
                });
            } else {
                // 尝试逐个字符解码（处理混合词典词和编码的情况）
                let decoded = '';
                let currentToken = '';
                for (const char of token) {
                    currentToken += char;
                    if (this.#dictionary.bear.has(currentToken)) {
                        decoded += this.#dictionary.bear.get(currentToken);
                        currentToken = '';
                    }
                }
                // 如果还有剩余字符，尝试二进制解码
                if (currentToken) {
                    decoded += this.#decodeBinary(currentToken);
                }
                result.push({
                    text: decoded,
                    type: 'decode'
                });
            }
        }
        
        return {
            displayText: result.map(r => r.text).join(''),
            details: result
        };
    }

    static #decodeBinary(token) {
        const clean = token.replace(/[^啊哒.~]/g, '');
        if(clean.length !== this.#config.bitLength/2) return token;

        let binStr = '';
        for(const c of clean) {
            binStr += this.#config.reverseBase4Map.get(c) || '00';
        }

        try {
            const codePoint = parseInt(binStr, 2);
            return String.fromCodePoint(codePoint);
        } catch {
            return '�';
        }
    }

    static #updateStatus(msg) {
        document.getElementById('status').textContent = msg;
    }
}

if (typeof window !== 'undefined') {
    window.BearTranslator = BearTranslator;
}
