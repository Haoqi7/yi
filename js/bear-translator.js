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
            // 修复1: 允许"了"字被处理
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
        const bearTokens = text.match(/[哒啊·~.。\u2764\u231a\u2600\u263a\u{1f300}-\u{1f5ff}\u{1f600}-\u{1f64f}]/gu)?.length || 0;
        return cnChars > bearTokens ? 'cn2bear' : 'bear2cn';
    }

    static #encodeChinese(text) {
        const result = [];
        let pos = 0;
        const totalLen = text.length;

        while (pos < totalLen) {
            let matched = false;
            const maxCheck = Math.min(
                this.#dictionary.cn.maxLength,
                totalLen - pos
            );

            // 优先匹配最长短语
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
                // 编码后添加分隔符，确保解码时能正确分割
                result.push({
                    text: this.#encodeBinary(text[pos]) + this.#config.separator,
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
        return encoded;
    }

    static #decodeBear(text) {
        const result = [];
        let remaining = text;
        const separatorRegex = new RegExp(this.#config.separator + '|\\s+', 'g');
        
        while (remaining) {
            let matched = false;
            
            // 提取所有可能的分隔符位置
            const separators = [];
            let match;
            // 重置正则表达式状态
            separatorRegex.lastIndex = 0;
            while ((match = separatorRegex.exec(remaining)) !== null) {
                separators.push(match.index);
            }
            
            // 从最长可能的短语开始尝试匹配
            const possibleEnds = [...separators, remaining.length];
            for (const end of possibleEnds.sort((a, b) => b - a)) {
                const candidate = remaining.substring(0, end).trim();
                if (candidate && this.#dictionary.bear.has(candidate)) {
                    result.push({
                        text: this.#dictionary.bear.get(candidate),
                        type: 'dict'
                    });
                    // 跳过已匹配部分和分隔符
                    remaining = remaining.substring(end);
                    separatorRegex.lastIndex = 0;
                    remaining = remaining.replace(separatorRegex, '', 1);
                    matched = true;
                    break;
                }
            }
            
            if (matched) continue;
            
            // 如果没有匹配到完整短语，按分隔符拆分单个token处理
            const firstSeparator = remaining.search(separatorRegex);
            let token;
            if (firstSeparator === -1) {
                token = remaining;
                remaining = '';
            } else {
                token = remaining.substring(0, firstSeparator);
                remaining = remaining.substring(firstSeparator);
                separatorRegex.lastIndex = 0;
                remaining = remaining.replace(separatorRegex, '', 1);
            }
            
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
        const clean = token.replace(/[^啊哒.~。]/g, '');
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
