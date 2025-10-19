class BearTranslator {
    static #dictionary = {
        cn: {
            single: new Map(), // 单字词典
            phrases: new Map(), // 多字词词典（key为长度）
            maxLength: 1 // 最长词条长度
        },
        bear: new Map(), // 熊语到中文的映射
        loaded: false
    };

    static #config = {
        bitLength: 20, // 编码位数
        separator: '·', // 编码分隔符
        base4Map: new Map([ // 二进制到熊语的映射
            ['00', '啊'], ['01', '哒'],
            ['10', '.'], ['11', '。']
        ]),
        reverseBase4Map: new Map([ // 熊语到二进制的映射
            ['啊', '00'], ['哒', '01'],
            ['.', '10'], ['。', '11']
        ])
    };

    // 初始化：加载词典
    static async init() {
        try {
            await this.#loadDictionary();
            this.#updateStatus('✅ 词库加载完成');
            this.#dictionary.loaded = true;
        } catch (e) {
            console.error('词库加载错误:', e);
            this.#updateStatus('⚠️ 词库加载失败，仅使用编码转换');
            this.#resetDictionary(); // 重置为空词典
        }
    }

    // 加载词典文件（修复路径：从js目录向上一级找）
    static async #loadDictionary() {
        const response = await fetch('../dictionary.json');
        if (!response.ok) {
            throw new Error(`加载失败: ${response.status}（可能路径错误）`);
        }
        const data = await response.json();
        
        this.#resetDictionary();
        // 遍历词典数据，构建映射
        Object.entries(data.main).forEach(([key, value]) => {
            if (key === "了") return; // 跳过特殊字符

            if (key.length === 1) {
                this.#dictionary.cn.single.set(key, value); // 单字
            } else {
                const len = key.length;
                if (!this.#dictionary.cn.phrases.has(len)) {
                    this.#dictionary.cn.phrases.set(len, new Map());
                }
                this.#dictionary.cn.phrases.get(len).set(key, value); // 多字词
                this.#dictionary.cn.maxLength = Math.max(this.#dictionary.cn.maxLength, len);
            }
            this.#dictionary.bear.set(value, key); // 熊语到中文的反向映射
        });
    }

    // 重置词典（加载失败时用）
    static #resetDictionary() {
        this.#dictionary.cn.single.clear();
        this.#dictionary.cn.phrases.clear();
        this.#dictionary.bear.clear();
        this.#dictionary.cn.maxLength = 1;
    }

    // 核心转换方法（支持useDictionary参数）
    static convert(text, mode, useDictionary = true) {
        const realMode = mode === 'auto' ? 
            this.#detectLanguage(text) : mode;
        
        return realMode === 'cn2bear' ? 
            this.#encodeChinese(text, useDictionary) : 
            this.#decodeBear(text, useDictionary);
    }

    // 自动检测语言类型（中文/熊语）
    static #detectLanguage(text) {
        const cnChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0; // 中文字符数
        const bearTokens = text.match(/[哒啊·.~]/g)?.length || 0; // 熊语特征字符数
        return cnChars > bearTokens ? 'cn2bear' : 'bear2cn';
    }

    // 中文转熊语（支持useDictionary控制是否用词典）
    static #encodeChinese(text, useDictionary) {
        const result = [];
        let pos = 0;
        const totalLen = text.length;

        while (pos < totalLen) {
            const currentChar = text[pos];
            if (currentChar === "了") { // 跳过"了"
                pos++;
                continue;
            }

            let matched = false;
            // 如果启用词典，尝试匹配词典中的词条
            if (useDictionary) {
                const maxCheck = Math.min(
                    this.#dictionary.cn.maxLength,
                    totalLen - pos
                );

                // 从最长可能的词条开始匹配（优先匹配多字词）
                for (let checkLen = maxCheck; checkLen >= 1; checkLen--) {
                    const candidate = text.substr(pos, checkLen);
                    const dictMap = checkLen === 1 ? 
                        this.#dictionary.cn.single : 
                        (this.#dictionary.cn.phrases.get(checkLen) || new Map());

                    if (dictMap.has(candidate)) {
                        result.push({
                            text: dictMap.get(candidate),
                            type: 'dict' // 标记为词典转换
                        });
                        pos += checkLen;
                        matched = true;
                        break;
                    }
                }
            }

            // 未匹配到词典（或未启用词典），则使用编码转换
            if (!matched) {
                result.push({
                    text: this.#encodeBinary(text[pos]),
                    type: 'encode' // 标记为编码转换
                });
                pos++;
            }
        }
        
        return {
            displayText: result.map(r => r.text).join(''),
            details: result
        };
    }

    // 单个字符转二进制编码（熊语）
    static #encodeBinary(char) {
        const codePoint = char.codePointAt(0); // 获取字符的Unicode码点
        const binStr = codePoint.toString(2)
            .padStart(this.#config.bitLength, '0'); // 补全为20位二进制
        
        let encoded = '';
        for(let i=0; i<binStr.length; i+=2) {
            const pair = binStr.substr(i, 2); // 每2位一组
            encoded += this.#config.base4Map.get(pair) || '??'; // 映射为熊语字符
        }
        return encoded + this.#config.separator; // 加分隔符
    }

    // 熊语转中文（支持useDictionary控制是否用词典）
    static #decodeBear(text, useDictionary) {
        const tokens = text.split(/[\s·]+/); // 按分隔符拆分熊语
        const result = [];

        for (const token of tokens) {
            if (!token) continue; // 跳过空字符
            // 如果启用词典，尝试匹配词典中的熊语
            if (useDictionary && this.#dictionary.bear.has(token)) {
                result.push({
                    text: this.#dictionary.bear.get(token),
                    type: 'dict' // 标记为词典转换
                });
            } else {
                // 未匹配到词典（或未启用词典），则使用解码转换
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

    // 熊语编码转字符
    static #decodeBinary(token) {
        const clean = token.replace(/[^啊哒.~]/g, ''); // 过滤无效字符
        if(clean.length !== this.#config.bitLength/2) return token; // 长度不对则不解码

        let binStr = '';
        for(const c of clean) {
            binStr += this.#config.reverseBase4Map.get(c) || '00'; // 转换为二进制
        }

        try {
            const codePoint = parseInt(binStr, 2); // 二进制转整数（Unicode码点）
            return String.fromCodePoint(codePoint); // 码点转字符
        } catch {
            return '�'; // 解码失败
        }
    }

    // 更新状态显示
    static #updateStatus(msg) {
        document.getElementById('status').textContent = msg;
    }
}

if (typeof window !== 'undefined') {
    window.BearTranslator = BearTranslator;
}
