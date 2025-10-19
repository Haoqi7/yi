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
    static async #loadDictionary() {
        // 尝试多个可能的路径
        const possiblePaths = [
            'https://raw.githubusercontent.com/Haoqi7/yi/blob/main/js/dictionary.json',
            './js/dictionary.json'
        ];
    static async init() {
        try {
            // 尝试加载外部词典
            await this.#loadDictionary();
            this.#updateStatus('✅ 词库加载完成');
            this.#dictionary.loaded = true;
        } catch (e) {
            console.log('使用内嵌词典:', e.message);
            // 使用内嵌词典作为备选
            this.#loadEmbeddedDictionary();
            this.#updateStatus('✅ 使用内嵌词库');
            this.#dictionary.loaded = true;
        }
    }


        
        let response;
        for (const path of possiblePaths) {
            try {
                response = await fetch(path);
                if (response.ok) {
                    console.log(`成功加载词典: ${path}`);
                    break;
                }
            } catch (e) {
                console.log(`尝试路径 ${path} 失败:`, e);
            }
        }
        
        if (!response || !response.ok) {
            throw new Error('所有外部路径尝试均失败');
        }
        
        const data = await response.json();
        this.#processDictionaryData(data);
    }

    static #loadEmbeddedDictionary() {
        // 内嵌词典数据
        const embeddedDictionary = {
            main: {
                "+": "+",
                "分隔符": "+",
                "我": "哒",
                "你": "啊哒",
                "他": "哒啊",
                "的": "啊",
                "是": "哒!",
                "不": "达",
                "在": "啊啊哒",
                "有": "哒啊啊",
                "好": "啊啊",
                "人": "哒。",
                "上": "+哒",
                "下": "-哒",
                "中": ".哒",
                "大": "啊。",
                "小": "。啊",
                "天": "☀",
                "地": "🌍",
                "一": "阿",
                "二": "达",
                "三": "哒哒",
                "四": "啊达",
                "五": "达啊",
                "六": "哒啊哒",
                "七": "啊哒啊",
                "八": "哒。哒",
                "九": "。哒。",
                "十": "啊.啊",
                "爸": "达.",
                "妈": "阿.",               
                "俺": "啊阿.",           
                "个": "达达.",           
                "说": "阿阿.",  
                "和": ".",        
                "吗": "？",
                "吖": "!",
                "什么": "??",
                "谢谢": "哒哒!",
                "再见": "哒啊~哒啊",
                "爱": "❤哒",
                "开心": "~哒",
                "生气": "-哒",
                "困": "zz哒",
                "去": "哒",
                "来": "哒",
                "忘": "啊::", 
                "家": "🏠",
                "祝": "啊",
                "大家": "哒",
                "宿舍": "🏠哒",
                "建议": "哒",
                "时间": "达达",      
                "早上": "☀哒",
                "晚上": "🌙哒",
                "晚安": "🌙哒哒",
                "吃饭了吗": "🍚哒??",
                "在哪里": "📍哒??",
                "工作": "💼哒啊",
                "学习": "📖哒哒",
                "多少钱": "💰啊哒??",
                "没问题": "👌哒!",
                "对不起": "😔哒啊",
                "恭喜": "哒哒🎉!!",
                "生日": "🎂哒",
                "快乐": "哒🎉",
                "等一下": "⏳哒",
                "马上": "💨",
                "小心": "啊哒哒!!",
                "注意安全": "啊哒!!",
                "加油": "🔥啊🔥",
                "完蛋": "啊>啊",
                "怎么": "(o?",
                "没事": "哒~",
                "情人节": "💑~",
                "宝宝": "达达",
                "怎么了": "(・・)??",
                "真的吗": "哒!?",
                "好吧": "啊~",
                "快点": "💨哒!",
                "等等我": "⏳💨",
                "别闹": "达达!",
                "厉害": "👏👏哒",
                "尴尬": "|||达",
                "无语": "......",
                "离谱": "👎✗",
                "晚安": "🌙💤",
                "约会": "💘哒",
                "逛街": "哒👠",
                "看电影": "🎬哒",
                "求放过": "🙏😇",
                "好累": "💤💤",
                "笑死": "www哒",
                "哭了": "😭📉",
                "取消": "❌哒",
                "成功": "哒✓",
                "失败": "✖哒",
                "完成": "🎯✓",
                "危险": "☠哒",
                "安全": "🛡哒",
                "一二": "阿哒",
                "布布": "阿哒哒"
            }
        };
        
        this.#processDictionaryData(embeddedDictionary);
    }

    static #processDictionaryData(data) {
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

    static #decodeBear(text, useDictionary) {
        // 分割文本，同时保留可能的分隔符
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
        if (typeof document !== 'undefined') {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = msg;
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.BearTranslator = BearTranslator;
}





