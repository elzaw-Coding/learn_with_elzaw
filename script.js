const app = {
    data: JSON.parse(localStorage.getItem('learnly_data') || '[]'),
    testList: [],
    currentIndex: 0,
    currentTab: 'daily',
    testType: 'write', 
    userScramble: [],

    init: () => {
        app.render();
        const loadVoices = () => {
            const select = document.getElementById('voiceSelect');
            const voices = window.speechSynthesis.getVoices();
            select.innerHTML = voices.map((v, i) => `<option value="${i}">${v.name} (${v.lang})</option>`).join('');
        };
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    },

    exportData: () => {
        if(app.data.length === 0) return alert('لا توجد بيانات لتصديرها!');
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(app.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "my_vocabulary.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    importData: (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                app.data = importedData;
                localStorage.setItem('learnly_data', JSON.stringify(app.data));
                app.render();
                alert('تم استيراد البيانات بنجاح!');
            } catch (err) {
                alert('خطأ في استيراد الملف! تأكد أنه ملف صحيح.');
            }
        };
        reader.readAsText(file);
    },

    autoTranslate: async () => {
        const term = document.getElementById('term').value;
        if(!term) return alert('اكتب الكلمة أولاً!');
        try {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|ar`);
            const data = await res.json();
            document.getElementById('trans').value = data.responseData.translatedText;
        } catch(e) { alert('فشل الاتصال بالترجمة'); }
    },

    speak: (text) => {
        const voiceIdx = document.getElementById('voiceSelect').value;
        const voices = window.speechSynthesis.getVoices();
        const msg = new SpeechSynthesisUtterance(text);
        if (voices[voiceIdx]) msg.voice = voices[voiceIdx];
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(msg);
    },

    addEntry: () => {
        const term = document.getElementById('term').value;
        const trans = document.getElementById('trans').value;
        if(!term || !trans) return alert('أكمل البيانات');
        
        app.data.push({ 
            id: Date.now(), 
            term: term.trim(), 
            trans: trans.trim(), 
            date: new Date().toLocaleDateString(), 
            isHard: false, 
            isSentence: term.includes(' ') 
        });

        localStorage.setItem('learnly_data', JSON.stringify(app.data));
        document.getElementById('term').value = '';
        document.getElementById('trans').value = '';
        app.render();
    },

    switchTab: (tab) => {
        app.currentTab = tab;
        document.getElementById('tabDaily').classList.toggle('active', tab === 'daily');
        document.getElementById('tabHard').classList.toggle('active', tab === 'hard');
        app.render();
    },

    render: () => {
        const area = document.getElementById('displayArea');
        area.innerHTML = '';
        const filteredData = (app.currentTab === 'daily') ? app.data : app.data.filter(x => x.isHard);

        if (app.currentTab === 'daily') {
            const grouped = app.data.reduce((acc, curr) => { acc[curr.date] = acc[curr.date] || []; acc[curr.date].push(curr); return acc; }, {});
            Object.keys(grouped).forEach((date, i) => {
                area.innerHTML += `<h3 style="color:var(--accent); margin-top:20px;">Day ${i+1}</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px;">
                    <button class="action-btn" style="border:none; background:#334155" onclick="app.startTest('write', 'daily', '${date}')">كتابة</button>
                    <button class="action-btn" style="border:none; background:#334155" onclick="app.startTest('mcq', 'daily', '${date}')">اختيار</button>
                    <button class="action-btn" style="border:none; background:#334155" onclick="app.startTest('scramble', 'daily', '${date}')">ترتيب</button>
                </div>`;
                grouped[date].forEach(item => area.innerHTML += app.createCard(item));
            });
        } else {
            area.innerHTML += `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px;">
                <button class="action-btn" onclick="app.startTest('write', 'hard')">كتابة</button>
                <button class="action-btn" onclick="app.startTest('mcq', 'hard')">اختيار</button>
                <button class="action-btn" onclick="app.startTest('scramble', 'hard')">ترتيب</button>
            </div>`;
            filteredData.forEach(item => area.innerHTML += app.createCard(item));
        }
    },

    createCard: (item) => `
        <div class="word-card ${item.isHard ? 'hard':''}">
            <div class="card-header"><strong>${item.term}</strong><span style="color:var(--text-secondary)">${item.trans}</span></div>
            <div class="card-actions">
                <button class="action-btn" onclick="app.speak('${item.term}')">🔊</button>
                <button class="action-btn" onclick="app.toggleHard(${item.id})">${item.isHard ? '🔥' : '⚪'}</button>
                <button class="action-btn" style="border-color:var(--danger); color:var(--danger)" onclick="app.delete(${item.id})">🗑️</button>
            </div>
        </div>`,

    toggleHard: (id) => {
        const item = app.data.find(x => x.id === id);
        item.isHard = !item.isHard;
        localStorage.setItem('learnly_data', JSON.stringify(app.data));
        app.render();
    },

    delete: (id) => {
        app.data = app.data.filter(x => x.id !== id);
        localStorage.setItem('learnly_data', JSON.stringify(app.data));
        app.render();
    },

    startTest: (type, mode, date) => {
        app.testType = type;
        let source = (mode === 'daily') ? app.data.filter(x => x.date === date) : app.data.filter(x => x.isHard);
        
        if(type === 'scramble') {
            app.testList = source.filter(x => x.isSentence);
            if(app.testList.length === 0) return alert('لا توجد جمل لهذا الاختبار!');
        } else {
            app.testList = source;
        }

        if(app.testList.length === 0) return alert('لا توجد عناصر لهذا الاختبار!');
        app.currentIndex = 0;
        document.getElementById('testArea').style.display = 'flex';
        app.showQuestion();
    },

    showQuestion: () => {
        const item = app.testList[app.currentIndex];
        const area = document.getElementById('testBox');
        
        if(app.testType === 'write') {
            area.innerHTML = `<h2 style="color:var(--accent)">${item.trans}</h2>
                <input type="text" id="aInput" placeholder="اكتب الكلمة...">
                <button class="btn-main" onclick="app.checkAnswer('')">تحقق</button>
                <button style="background:none; border:none; color:white; margin-top:15px;" onclick="app.closeTest()">خروج</button>`;
            app.speak(item.term);
        } else if(app.testType === 'mcq') {
            const correct = item.trans;
            const options = [...app.data.filter(x => x.trans !== correct).sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.trans), correct].sort(() => 0.5 - Math.random());
            area.innerHTML = `<h2 style="color:var(--accent)">${item.term}</h2>
                <div id="optionsArea"></div><button style="background:none; border:none; color:white; margin-top:15px;" onclick="app.closeTest()">خروج</button>`;
            options.forEach(opt => {
                const btn = document.createElement('button'); btn.className = 'option-btn'; btn.innerText = opt;
                btn.onclick = () => app.checkAnswer(opt);
                document.getElementById('optionsArea').appendChild(btn);
            });
            app.speak(item.term);
        } else if(app.testType === 'scramble') {
            app.userScramble = [];
            const words = item.term.split(' ').sort(() => 0.5 - Math.random());
            area.innerHTML = `<h2 style="color:var(--accent)">رتب الجملة:</h2>
                <div id="displayScramble" style="min-height:50px; background:#1e293b; padding:10px; margin-bottom:10px; border-radius:8px"></div>
                <div id="optionsArea"></div>
                <button class="btn-main" onclick="app.checkScramble('${item.term}')">تحقق</button>
                <button style="background:none; border:none; color:white; margin-top:10px;" onclick="app.closeTest()">خروج</button>`;
            words.forEach(w => {
                const btn = document.createElement('span'); btn.className = 'scramble-word'; btn.innerText = w;
                btn.onclick = () => { app.userScramble.push(w); document.getElementById('displayScramble').innerText = app.userScramble.join(' '); btn.style.display='none'; };
                document.getElementById('optionsArea').appendChild(btn);
            });
            app.speak(item.term);
        }
    },

    checkAnswer: (selected) => {
        const item = app.testList[app.currentIndex];
        const inputVal = (app.testType === 'write') ? document.getElementById('aInput').value.trim().toLowerCase() : selected.trim().toLowerCase();
        const targetVal = item.term.trim().toLowerCase();
        const isCorrect = (app.testType === 'write') ? (inputVal === targetVal) : (selected === item.trans);

        if(isCorrect) {
            app.currentIndex++;
            if(app.currentIndex < app.testList.length) app.showQuestion();
            else { alert('أحسنت! انتهى الاختبار.'); app.closeTest(); }
        } else { alert('خطأ! حاول مجدداً'); }
    },

    checkScramble: (original) => {
        if(app.userScramble.join(' ') === original) { alert('صح!'); app.currentIndex++; if(app.currentIndex < app.testList.length) app.showQuestion(); else app.closeTest(); }
        else { alert('خطأ! حاول مرة أخرى'); app.userScramble = []; document.getElementById('displayScramble').innerText = ''; app.showQuestion(); }
    },

    closeTest: () => { document.getElementById('testArea').style.display = 'none'; app.render(); }
};
app.init();