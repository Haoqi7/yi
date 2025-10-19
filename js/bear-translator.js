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
        separator: '+',
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
            console.error('词库加载错误:', e);
            this.#updateStatus('⚠️ 词库加载失败，仅使用编码转换');
            this.#resetDictionary();
        }
    }

    static async #loadDictionary() {
        const response = await fetch('../dictionary.json');
        if (!response.ok) throw new Error(`加载失败: ${response.status}`);
        const data = await response.json();
        
        this.#resetDictionary();
        Object.entries(data.main).forEach(([key, value]) => {
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

    static convert(text, mode, useDictionary = true) {
        const realMode = mode === 'auto' ? 
            this.#detectLanguage(text) : mode;
        
        return realMode === 'cn2bear' ? 
            this.#encodeChinese(text, useDictionary) : 
            this.#decodeBear(text, useDictionary);
    }

    static #detectLanguage(text) {
        const cnChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
        const bearTokens = text.match(/[哒啊\.。~\+]/g)?.length || 0;
        return cnChars > bearTokens ? 'cn2bear' : 'bear2cn';
    }

    // 中文转熊语（完全重写）
    static #encodeChinese(text, useDictionary) {
        const result = [];
        const characters = Array.from(text);
        
        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            if (char === "了") continue;
            
            let found = false;
            if (useDictionary) {
                // 尝试匹配最长词组
                for (let len = Math.min(this.#dictionary.cn.maxLength, characters.length - i); len >= 1; len--) {
                    const phrase = characters.slice(i, i + len).join('');
                    const dictMap = len === 1 ? 
                        this.#dictionary.cn.single : 
                        (this.#dictionary.cn.phrases.get(len) || new Map());
                    
                    if (dictMap.has(phrase)) {
                        result.push({
                            text: dictMap.get(phrase),
                            type: 'dict'
                        });
                        i += len - 1;
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                result.push({
                    text: this.#encodeChar(char),
                    type: 'encode'
                });
            }
        }
        
        return {
            displayText: result.map(r => r.text).join(this.#config.separator),
            details: result
        };
    }

    // 单个字符编码（不使用字典）
    static #encodeChar(char) {
        const codePoint = char.codePointAt(0);
        const binStr = codePoint.toString(2).padStart(this.#config.bitLength, '0');
        let encoded = '';
        for (let i = 0; i < binStr.length; i += 2) {
            const pair = binStr.substr(i, 2);
            encoded += this.#config.base4Map.get(pair) || '??';
        }
        return encoded;
    }

    // 熊语转中文（完全重写）
    static #decodeBear(text, useDictionary) {
        const tokens = text.split(this.#config.separator);
        const result = [];
        
        for (const token of tokens) {
            if (!token) continue;
            
            if (useDictionary && this.#dictionary.bear.has(token)) {
                result.push({
                    text: this.#dictionary.bear.get(token),
                    type: 'dict'
                });
            } else {
                // 尝试作为编码解码
                const decoded = this.#decodeToken(token);
                result.push({
                    text: decoded,
                    type: decoded === token ? 'unknown' : 'decode'
                });
            }
        }
        
        return {
            displayText: result.map(r => r.text).join(''),
            details: result
        };
    }

    // 解码单个token（不使用字典）
    static #decodeToken(token) {
        // 检查是否为有效编码（10个熊语字符）
        const isValidEncoding = token.length === this.#config.bitLength / 2;
        const isEncodingChars = /^[啊哒\.。]+$/.test(token);
        
        if (isValidEncoding && isEncodingChars) {
            let binStr = '';
            for (const char of token) {
                binStr += this.#config.reverseBase4Map.get(char) || '00';
            }
            
            try {
                const codePoint = parseInt(binStr, 2);
                return String.fromCodePoint(codePoint);
            } catch {
                return token;
            }
        }
        return token;
    }

    static #updateStatus(msg) {
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = msg;
    }
}

if (typeof window !== 'undefined') {
    window.BearTranslator = BearTranslator;
}
