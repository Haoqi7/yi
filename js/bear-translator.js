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
        separator: '1', // 分隔符为“1”
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
            this.#dictionary.bear.set(value, key);
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
        const bearTokens = text.match(/[哒啊1.~]/g)?.length || 0;
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
                        type: 'dict' // 字典匹配项
                    });
                    pos += checkLen;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                result.push({
                    text: this.#encodeBinary(text[pos]), // 非字典项（编码结果）
                    type: 'encode'
                });
                pos++;
            }
        }
        
        // 核心修改：仅非字典项（encode）之间用分隔符分割
        return {
            displayText: (() => {
                const parts = [];
                for (let i = 0; i < result.length; i++) {
                    const current = result[i];
                    const prev = i > 0 ? result[i - 1] : null;
                    
                    // 只有当前项和前一项都是非字典项（encode）时，才添加分隔符
                    if (current.type === 'encode' && prev && prev.type === 'encode') {
                        parts.push(this.#config.separator);
                    }
                    parts.push(current.text);
                }
                return parts.join('');
            })(),
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
        // 注意：此处移除了自动添加的分隔符，因为分隔符仅用于非字典项之间的分割
        return encoded;
    }

    static #decodeBear(text) {
        const tokens = text.split(/1+/); // 按分隔符“1”分割token
        const result = [];

        for (const token of tokens) {
            if (token.trim() === '') continue; // 过滤空token
            if (this.#dictionary.bear.has(token)) {
                result.push({
                    text: this.#dictionary.bear.get(token),
                    type: 'dict'
                });
            } else {
                const decoded = this.#decodeBinary(token);
                result.push({
                    text: decoded !== token ? decoded : token,
                    type: decoded !== token ? 'decode' : 'unknown'
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
