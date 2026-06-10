const calendarDays = document.getElementById("calendarDays");
const selectedDateText = document.getElementById("selectedDate");
const scheduleList = document.getElementById("scheduleList");
const fab = document.querySelector(".fab");

let selectedDay =
Number(localStorage.getItem("selectedDay")) || null;

let schedules =
JSON.parse(localStorage.getItem("schedules")) || {};

const categories = [
    "学校",
    "アルバイト",
    "プライベート",
    "その他"
];

// カレンダー生成
for(let i=1;i<=31;i++){

    const day = document.createElement("div");

    day.classList.add("day");
    day.textContent = i;

    if(i === selectedDay){
        day.classList.add("selected");
    }

    day.addEventListener("click",()=>{

        document.querySelectorAll(".day")
        .forEach(d=>d.classList.remove("selected"));

        day.classList.add("selected");

        selectedDay = i;

        localStorage.setItem(
            "selectedDay",
            selectedDay
        );

        selectedDateText.textContent =
        `${i}日を選択中`;

        renderSchedules();
    });

    calendarDays.appendChild(day);
}

if(selectedDay){
    selectedDateText.textContent =
    `${selectedDay}日を選択中`;
}

// 予定追加
fab.addEventListener("click",()=>{

    if(selectedDay === null){

        alert("先に日付を選択してください");
        return;
    }

    const title = prompt("タイトル");

    if(!title) return;

    const category = prompt(
        `分類を入力してください\n${categories.join(" / ")}`
    );

    const start = prompt("開始時刻 (例:09:00)");
    const end = prompt("終了時刻 (例:10:30)");

    const allDay = confirm("終日予定ですか？");

    if(!schedules[selectedDay]){
        schedules[selectedDay] = [];
    }

    schedules[selectedDay].push({
        title,
        category,
        start,
        end,
        allDay
    });

    localStorage.setItem(
        "schedules",
        JSON.stringify(schedules)
    );

    renderSchedules();
});

// 予定表示
function renderSchedules(){

    scheduleList.innerHTML = "";

    const daySchedules =
    schedules[selectedDay] || [];

    daySchedules.forEach(schedule=>{

        const card =
        document.createElement("div");

        card.classList.add("schedule-card");

        card.innerHTML = `
            <h3>${schedule.title}</h3>

            <p>
            ${
                schedule.allDay
                ? "終日"
                : `${schedule.start} ～ ${schedule.end}`
            }
            </p>

            <span class="category">
                ${schedule.category}
            </span>
        `;

        scheduleList.appendChild(card);
    });
}

renderSchedules();