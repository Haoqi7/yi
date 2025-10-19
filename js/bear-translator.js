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
        separator: '1', // 分隔符为'1'
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
            // 显示详细错误信息（控制台+页面）
            const errorMsg = `⚠️ 词库加载失败：${e.message}（仅使用编码转换）`;
            this.#updateStatus(errorMsg);
            console.error('词库加载失败详情：', e); // 控制台打印完整错误
            this.#resetDictionary();
        }
    }

    static async #loadDictionary() {
        // 修正路径：根据实际目录结构调整（此处假设dictionary.json在根目录，js在子文件夹）
        const response = await fetch('../dictionary.json');
        
        // 验证HTTP响应状态（404/500等错误会触发此处）
        if (!response.ok) {
            throw new Error(`文件请求失败（状态码：${response.status}），请检查文件路径是否正确`);
        }

        // 解析JSON（若格式错误会触发catch）
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            throw new Error(`JSON格式错误：${parseError.message}，请检查dictionary.json语法`);
        }
        
        this.#resetDictionary();
        Object.entries(data.main).forEach(([key, value]) => {
            if (key === "了") return;

            // 跳过重复条目（双向唯一）
            if (this.#dictionary.cn.single.has(key) || 
                (this.#dictionary.cn.phrases.get(key.length)?.has(key)) ||
                this.#dictionary.bear.has(value)) {
                console.warn(`跳过重复条目: 中文"${key}" 熊语"${value}"`);
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
        const bearTokens = text.match(/[哒啊1.~。]/g)?.length || 0; // 包含分隔符'1'
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
        return encoded + this.#config.separator; // 添加'1'作为分隔符
    }

    static #decodeBear(text) {
        const result = [];
        let currentPos = 0;
        const textLen = text.length;

        while (currentPos < textLen) {
            let matched = false;
            // 尝试匹配最长词典词（最大长度10）
            for (let len = 10; len >= 1; len--) {
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

            // 尝试解码编码部分（10个字符+1个分隔符'1'）
            if (currentPos + 11 <= textLen) {
                const encodedPart = text.substr(currentPos, 10);
                const separator = text.substr(currentPos + 10, 1);
                if (separator === this.#config.separator) { // 检查是否为'1'
                    const decodedChar = this.#decodeBinary(encodedPart);
                    result.push({
                        text: decodedChar,
                        type: 'decode'
                    });
                    currentPos += 11;
                    continue;
                }
            }

            // 无法识别的字符直接保留
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
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = msg;
        } else {
            console.log('状态提示：', msg); // 若未找到status元素，在控制台显示
        }
    }
}

if (typeof window !== 'undefined') {
    window.BearTranslator = BearTranslator;
}
