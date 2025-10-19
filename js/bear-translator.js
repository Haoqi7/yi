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
        separator: '·', // 编码分隔符
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

            // 跳过中文重复条目
            if (this.#dictionary.cn.single.has(key) || 
                (this.#dictionary.cn.phrases.get(key.length)?.has(key))) {
                console.warn(`跳过重复中文条目: ${key}`);
                return;
            }

            // 跳过熊语重复条目（确保双向映射唯一）
            if (this.#dictionary.bear.has(value)) {
                console.warn(`跳过重复熊语条目: ${value}（已映射到${this.#dictionary.bear.get(value)}）`);
                return;
            }

            // 添加中文到熊语映射
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

            // 添加熊语到中文映射
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
        const bearTokens = text.match(/[哒啊·.~。]/g)?.length || 0;
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
            // 优先匹配长词组
            const maxCheck = Math.min(this.#dictionary.cn.maxLength, totalLen - pos);
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

            // 未匹配到则编码
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

    // 修复编码逻辑：确保特殊字符正确编码并添加分隔符
    static #encodeBinary(char) {
        const codePoint = char.codePointAt(0);
        // 转换为20位二进制（不足补0）
        const binStr = codePoint.toString(2).padStart(this.#config.bitLength, '0');
        
        let encoded = '';
        for (let i = 0; i < binStr.length; i += 2) {
            const pair = binStr.substr(i, 2);
            encoded += this.#config.base4Map.get(pair) || '??';
        }
        // 添加分隔符用于解码分割
        return encoded + this.#config.separator;
    }

    // 重写解码逻辑：支持混合词典词和编码的文本
    static #decodeBear(text) {
        const result = [];
        let currentPos = 0;
        const textLen = text.length;

        while (currentPos < textLen) {
            let matched = false;
            // 尝试匹配最长可能的词典词
            for (let len = 10; len >= 1; len--) { // 最大匹配长度10（可根据实际词典调整）
                if (currentPos + len > textLen) continue;
                const candidate = text.substr(currentPos, len);
                if (this.#dictionary.bear.has(candidate)) {
                    result.push({
                        text: this.#dictionary.bear.get(candidate),
                        type: 'dict'
                    });
                    currentPos += len;
                    matched = true;
                    break;
                }
            }

            if (matched) continue;

            // 未匹配到则尝试解码编码部分（长度固定为10个字符+1个分隔符）
            if (currentPos + 11 <= textLen) { // 10个编码字符 + 1个分隔符
                const encodedPart = text.substr(currentPos, 10);
                const separator = text.substr(currentPos + 10, 1);
                if (separator === this.#config.separator) {
                    const decodedChar = this.#decodeBinary(encodedPart);
                    if (decodedChar !== encodedPart) { // 解码成功
                        result.push({
                            text: decodedChar,
                            type: 'decode'
                        });
                        currentPos += 11; // 跳过编码部分+分隔符
                        continue;
                    }
                }
            }

            // 都失败则直接取单个字符
            result.push({
                text: text[currentPos],
                type: 'unknown'
            });
            currentPos++;
        }
        
        return {
            displayText: result.map(r => r.text).join(''),
            details: result
        };
    }

    static #decodeBinary(token) {
        const clean = token.replace(/[^啊哒.~。]/g, '');
        if (clean.length !== this.#config.bitLength / 2) return token;

        let binStr = '';
        for (const c of clean) {
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
