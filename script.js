const app = {
  data: JSON.parse(localStorage.getItem("learnly_data") || "[]"),
  testList: [],
  wrongAttempts: 0,
  currentIndex: 0,
  currentTab: "daily",
  testType: "write",
  selectedVoice: null,
  selectedWords: [],
  availableWords: [],
  score: 0,
  totalQuestions: 0,
  failedQuestions: new Set(),

  init: () => {
    app.render();
    const setupVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      app.selectedVoice =
        voices.find(
          (v) => v.name.includes("Google") || v.name.includes("Neural"),
        ) || voices[0];
    };
    window.speechSynthesis.onvoiceschanged = setupVoice;
    setupVoice();
  },

  showToast: (msg, isSuccess) => {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.className = `toast ${isSuccess ? "success" : "error"}`;
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 2000);
  },

  speak: (text) => {
    const msg = new SpeechSynthesisUtterance(text);
    if (app.selectedVoice) msg.voice = app.selectedVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  },

  addEntry: () => {
    const term = document
      .getElementById("term")
      .value.trim()
      .replace(/\s+/g, " ");
    const trans = document.getElementById("trans").value.trim();

    if (!term || !trans) return app.showToast("أكمل البيانات", false);

    const isDuplicate = app.data.some(
      (item) => item.term.toLowerCase() === term.toLowerCase(),
    );

    if (isDuplicate) {
      return app.showToast("هذه الكلمة موجودة مسبقاً!", false);
    }

    app.data.push({
      id: Date.now(),
      term,
      trans,
      date: new Date().toLocaleDateString(),
      isHard: false,
      isSentence: term.includes(" "),
    });

    localStorage.setItem("learnly_data", JSON.stringify(app.data));
    document.getElementById("term").value = "";
    document.getElementById("trans").value = "";
    app.render();
    app.showToast("تم الإضافة بنجاح!", true);
  },
  autoTranslate: async () => {
    const term = document.getElementById("term").value.trim();
    if (!term) return;
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|ar`,
      );
      const data = await res.json();
      document.getElementById("trans").value = data.responseData.translatedText;
    } catch (e) {
      app.showToast("فشل الاتصال!", false);
    }
  },

  startTest: (type, mode, date) => {
    app.testType = type;
    let source =
      mode === "daily"
        ? app.data.filter((x) => x.date === date)
        : app.data.filter((x) => x.isHard);

    app.testList =
      type === "scramble"
        ? source.filter((x) => x.isSentence)
        : source.filter((x) => !x.isSentence);

    if (app.testList.length === 0)
      return app.showToast("لا يوجد عناصر لهذا النوع!", false);

    app.score = 0;
    app.totalQuestions = app.testList.length;
    app.failedQuestions = new Set();
    app.currentIndex = 0;
    document.getElementById("testArea").style.display = "flex";
    app.showQuestion();
  },

  showQuestion: () => {
    const item = app.testList[app.currentIndex];
    const area = document.getElementById("testBox");
    const audioBtn = `<button class="action-btn" style="background:#334155; margin-bottom:10px;" onclick="app.speak('${item.term}')">🔊 سماع</button>`;

    if (app.testType === "write") {
      area.innerHTML = `${audioBtn}<h2 style="color:var(--accent)">${item.trans}</h2><input type="text" id="aInput" placeholder="اكتب...">
            <button class="btn-main" onclick="app.checkAnswer('')">تحقق</button><button style="background:none; border:none; color:white; margin-top:15px;" onclick="app.closeTest()">خروج</button>`;
    } else if (app.testType === "mcq") {
      const options = [
        ...app.data
          .filter((x) => x.trans !== item.trans)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map((x) => x.trans),
        item.trans,
      ].sort(() => 0.5 - Math.random());
      area.innerHTML = `${audioBtn}<h2 style="color:var(--accent)">${item.term}</h2><div id="optionsArea"></div><button style="background:none; border:none; color:white; margin-top:15px;" onclick="app.closeTest()">خروج</button>`;
      options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerText = opt;
        btn.onclick = () => app.checkAnswer(opt);
        document.getElementById("optionsArea").appendChild(btn);
      });
    } else {
      app.availableWords = item.term
        .split(" ")
        .map((word, index) => ({ id: index, val: word }))
        .sort(() => 0.5 - Math.random());
      app.selectedWords = [];
      app.renderScrambleUI(item.term);
    }
    app.speak(item.term);
  },

  renderScrambleUI: (original) => {
    const area = document.getElementById("testBox");
    area.innerHTML = `<button class="action-btn" style="background:#334155; margin-bottom:10px;" onclick="app.speak('${original}')">🔊 سماع</button>
        <h2 style="color:var(--accent)">رتب الجملة:</h2>
        <div id="displayScramble" style="min-height:60px; background:#1e293b; padding:10px; margin-bottom:10px; border-radius:8px; display:flex; flex-wrap:wrap; flex-direction:row-reverse; justify-content:flex-start; gap:5px;"></div>
        <div id="poolArea" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center;"></div>
        <button class="btn-main" onclick="app.checkScramble('${original}')">تحقق</button>
        <button style="background:none; border:none; color:white; margin-top:10px;" onclick="app.closeTest()">خروج</button>`;

    const display = document.getElementById("displayScramble");
    const pool = document.getElementById("poolArea");
    app.selectedWords.forEach((w) => {
      const btn = document.createElement("span");
      btn.className = "scramble-word";
      btn.innerText = w.val;
      btn.onclick = () => {
        app.availableWords.push(w);
        app.selectedWords = app.selectedWords.filter((x) => x.id !== w.id);
        app.renderScrambleUI(original);
      };
      display.appendChild(btn);
    });
    app.availableWords.forEach((w) => {
      const btn = document.createElement("span");
      btn.className = "scramble-word";
      btn.style.background = "#334155";
      btn.innerText = w.val;
      btn.onclick = () => {
        app.selectedWords.push(w);
        app.availableWords = app.availableWords.filter((x) => x.id !== w.id);
        app.renderScrambleUI(original);
      };
      pool.appendChild(btn);
    });
  },

  checkScramble: (original) => {
    const item = app.testList[app.currentIndex];
    const userAns = app.selectedWords.map((w) => w.val).join(" ");
    if (userAns === original) {
      if (!app.failedQuestions.has(item.id)) app.score++;
      app.currentIndex++;
      if (app.currentIndex < app.testList.length) app.showQuestion();
      else app.finishTest();
    } else {
      app.failedQuestions.add(item.id);
      app.markAsHard(item.id);
      app.showToast("خطأ! تم نقلها للصعوبات", false);
    }
  },

  checkAnswer: (selected) => {
    const item = app.testList[app.currentIndex];
    const isCorrect =
      app.testType === "write"
        ? document.getElementById("aInput").value.trim().toLowerCase() ===
          item.term.trim().toLowerCase()
        : selected === item.trans;

    if (isCorrect) {
      if (!app.failedQuestions.has(item.id)) app.score++;
      app.currentIndex++;
      app.wrongAttempts = 0;
      if (app.currentIndex < app.testList.length) app.showQuestion();
      else app.finishTest();
    } else {
      app.markAsHard(item.id);

      if (app.testType === "write") {
        app.wrongAttempts++;
        if (app.wrongAttempts >= 3) {
          const area = document.getElementById("testBox");
          area.innerHTML = `
                        <h2 style="color:var(--danger)">انتهت المحاولات!</h2>
                        <p>الكلمة الصحيحة هي:</p>
                        <h1 style="color:var(--accent); font-size: 2em; margin: 20px 0;">${item.term}</h1>
                        <button class="btn-main" onclick="app.nextQuestion()">التالي</button>
                    `;
        } else {
          app.showToast(`خطأ! المحاولة ${app.wrongAttempts} من 3`, false);
        }
      } else {
        app.showToast("إجابة خاطئة!", false);
        app.currentIndex++;
        if (app.currentIndex < app.testList.length) app.showQuestion();
        else app.finishTest();
      }
    }
  },

  nextQuestion: () => {
    app.currentIndex++;
    if (app.currentIndex < app.testList.length) {
      app.showQuestion();
    } else {
      app.finishTest();
    }
  },

  finishTest: () => {
    app.showToast(
      `انتهى! النتيجة: ${Math.round((app.score / app.totalQuestions) * 100)}%`,
      true,
    );
    setTimeout(app.closeTest, 2000);
  },

  toggleDate: (date) => {
    const cleanDate = date.replace(/\//g, "-");
    const targetList = document.getElementById(`list-${cleanDate}`);
    const targetIcon = document.getElementById(`icon-${cleanDate}`);
    const isTargetOpen = targetList.style.display === "block";

    document
      .querySelectorAll(".date-list")
      .forEach((list) => (list.style.display = "none"));
    document
      .querySelectorAll(".day-icon")
      .forEach((icon) => (icon.innerText = "🔽"));

    if (!isTargetOpen) {
      targetList.style.display = "block";
      targetIcon.innerText = "🔼";
    }
  },

  render: () => {
    const area = document.getElementById("displayArea");
    area.innerHTML = "";
    if (app.currentTab === "daily") {
      const grouped = app.data.reduce((acc, curr) => {
        acc[curr.date] = acc[curr.date] || [];
        acc[curr.date].push(curr);
        return acc;
      }, {});
      Object.keys(grouped).forEach((date, i) => {
        const cleanDate = date.replace(/\//g, "-");
        area.innerHTML += `
                <div style="background:#112240; padding:10px; margin:10px 0; border-radius:8px; cursor:pointer" onclick="app.toggleDate('${date}')">
                    <h3 style="color:var(--accent); margin:0; display:flex; justify-content:space-between;">
                        Day ${i + 1} (${date}) <span id="icon-${cleanDate}" class="day-icon">🔽</span>
                    </h3>
                </div>
                <div id="list-${cleanDate}" class="date-list" style="display:none">
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-bottom:10px;">
                        <button class="action-btn" onclick="app.startTest('write', 'daily', '${date}')">كتابة</button>
                        <button class="action-btn" onclick="app.startTest('mcq', 'daily', '${date}')">اختيار</button>
                        <button class="action-btn" onclick="app.startTest('scramble', 'daily', '${date}')">ترتيب</button>
                    </div>
                    ${grouped[date].map((item) => app.createCard(item)).join("")}
                </div>`;
      });
    } else {
      area.innerHTML += `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-bottom:10px;">
                <button class="action-btn" onclick="app.startTest('write', 'hard')">كتابة</button>
                <button class="action-btn" onclick="app.startTest('mcq', 'hard')">اختيار</button>
                <button class="action-btn" onclick="app.startTest('scramble', 'hard')">ترتيب</button>
            </div>`;
      app.data
        .filter((x) => x.isHard)
        .forEach((item) => (area.innerHTML += app.createCard(item)));
    }
  },

  createCard: (item) => `
        <div class="word-card ${item.isHard ? "hard" : ""}">
            <div class="card-header"><strong>${item.term}</strong><span style="color:var(--text-secondary)">${item.trans}</span></div>
            <div class="card-actions">
                <button class="action-btn" onclick="app.speak('${item.term}')">🔊</button>
                <button class="action-btn" onclick="app.toggleHard(${item.id})">${item.isHard ? "🔥" : "⚪"}</button>
                <button class="action-btn" style="border-color:var(--danger); color:var(--danger)" onclick="app.delete(${item.id})">🗑️</button>
            </div>
        </div>`,
  toggleHard: (id) => {
    app.data.find((x) => x.id === id).isHard = !app.data.find(
      (x) => x.id === id,
    ).isHard;
    localStorage.setItem("learnly_data", JSON.stringify(app.data));
    app.render();
  },
  delete: (id) => {
    app.data = app.data.filter((x) => x.id !== id);
    localStorage.setItem("learnly_data", JSON.stringify(app.data));
    app.render();
  },
  closeTest: () => {
    document.getElementById("testArea").style.display = "none";
    app.render();
  },
  exportData: () => {
    const a = document.createElement("a");
    a.href =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(app.data));
    a.download = "data.json";
    a.click();
  },
  importData: (e) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      app.data = JSON.parse(e.target.result);
      localStorage.setItem("learnly_data", JSON.stringify(app.data));
      app.render();
    };
    reader.readAsText(e.target.files[0]);
  },
  switchTab: (tab) => {
    app.currentTab = tab;
    document
      .getElementById("tabDaily")
      .classList.toggle("active", tab === "daily");
    document
      .getElementById("tabHard")
      .classList.toggle("active", tab === "hard");
    app.render();
  },
  markAsHard: (id) => {
    app.data.find((x) => x.id === id).isHard = true;
    localStorage.setItem("learnly_data", JSON.stringify(app.data));
  },
};
app.init();
