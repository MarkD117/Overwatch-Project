//  Declaring Global Variables

var questions = [];           // All questions loaded from JSON
var currentQuestions = [];    // Filtered + shuffled subset of questions for this game
var currentIndex = 0;         // Which question the player is on (0-based)
var score = 0;                // Number of correct answers so far
var userAnswers = [];         // Player's answer index for each question
var questionTimes = [];       // Seconds spent on each individual question
var totalSeconds = 0;         // Running total timer (counts up every second)
var questionStartTime = 0;    // totalSeconds value when the current question started
var timerInterval;            // Stores the setInterval ID so we can clearInterval it

// Shorthand helper function for getting ids
function $(id) {
    return document.getElementById(id);
}

//  window.onload contains all event handler assignments
window.onload = function () {

    $("start-btn").onclick = startQuiz;
    $("next-btn").onclick = nextQuestion;
    $("review-btn").onclick = showReview;
    $("back-from-review-btn").onclick = showResults;
    $("review-back-to-top-btn").onclick = function () { window.scrollTo(0, 0); };
    $("play-again-btn").onclick = playAgain;
    $("save-score-btn").onclick = saveToLeaderboard;
    $("clear-leaderboard-btn").onclick = clearLeaderboard;

    // Validate the number input live as the user types
    $("num-questions").oninput = validateNumInput;

    // Wire up difficulty toggle buttons single-select behaviour
    // so that only one button can be selected as active
    var diffBtns = document.querySelectorAll(".difficulty-btn");
    diffBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            // Remove active from all, add to clicked button
            diffBtns.forEach(function (diffBtn) { diffBtn.classList.remove("active"); });
            btn.classList.add("active");
        });
    });

    // Initialise leaderboard with defaults if localStorage is empty,
    // then render whatever is stored.
    initLeaderboard();

    // Load questions from the JSON file in the background
    loadQuestions();
};

/** 
 * loadQuestions
 *  Uses fetch() with .then() to read data/questions.json 
 *  and store the array in the global `questions`. 
 */  
function loadQuestions() {
    fetch("data/questions.json")
        .then(response => response.json())
        .then(data => questions = data)
        .catch(error => {
            alert("Could not load quiz questions. Please refresh the page.");
            console.error('Error loading the data:', error);
        });
}

/**
 * validateNumInput
 * Called on every keystroke in the number field to check if the input
 * is valid. Uses parseInt() + isNaN() to ensure input is a number. 
 * Tells user if their input is incorrect.
 */
function validateNumInput() {
    var inputString = $("num-questions").value;
    // Convert string to whole number using base 10
    var numQuestions = parseInt(inputString, 10);
    var inputErrorEl = $("num-error");

    if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 50) {
        inputErrorEl.classList.remove("hidden");
        inputErrorEl.textContent = "Please enter a whole number between 1 and 50.";
    } else {
        inputErrorEl.classList.add("hidden");
    }
}

/**
 * startQuiz
 * Reads user's setup choices, validates them, filters/shuffles
 * the question pool, then switches to the question screen.
 */
function startQuiz() {
    // 1. Gather checked categories
    var checkboxes = document.querySelectorAll(".category-checkbox:checked");
    var selectedCategories = [];
    checkboxes.forEach(function (cb) {
        selectedCategories.push(cb.value);
    });

    if (selectedCategories.length === 0) {
        alert("Please select at least one category before starting.");
        return;
    }

    // 2. Validate number input (Secondary validation for safety)
    var numInput = parseInt($("num-questions").value, 10);
    if (isNaN(numInput) || numInput < 1 || numInput > 50) {
        $("num-error").classList.remove("hidden");
        $("num-error").textContent = "Please enter a whole number between 1 and 50.";
        return;
    }
    $("num-error").classList.add("hidden");

    // 3. Read difficulty from the active toggle button
    var activeDiffBtn = document.querySelector(".difficulty-btn.active");
    // Defaults to "All" if no active difficulty button is found
    var difficulty = activeDiffBtn ? activeDiffBtn.getAttribute("data-difficulty") : "All";

    // 4. Filter the question pool by category and difficulty
    var filteredQuestions = questions.filter(function (question) {
        // checks if the category that was selected by the user exists in the selected categories array
        var categoryMatches = selectedCategories.includes(question.category);
        // If the user picked 'All', pass every question through, otherwise only
        // pass questions whose difficulty matches what the user selected.
        var difficultyMatches = (difficulty === "All") || (question.difficulty === difficulty);
        return categoryMatches && difficultyMatches;
    });

    // Safeguard if a category has no questions for the chosen difficulty
    if (filteredQuestions.length === 0) {
        alert("No questions match your chosen categories and difficulty. Try a different combination.");
        return;
    }

    // 5. Shuffle using Fisher-Yates algorithm
    filteredQuestions = shuffleArray(filteredQuestions);

    // 6. Warn if fewer questions exist than requested, then trim
    if (numInput > filteredQuestions.length) {
        alert(
            "Only " + filteredQuestions.length + " question(s) are available for your selection.\n" +
            "Starting the quiz with " + filteredQuestions.length + " question(s)."
        );
        numInput = filteredQuestions.length;
    }

    // 7. Store the game state
    currentQuestions = filteredQuestions.slice(0, numInput);
    currentIndex = 0;
    score = 0;
    userAnswers = [];
    questionTimes = [];
    totalSeconds = 0;

    // 8. Reset save-score button in case of a previous game
    $("save-score-btn").textContent = "Save Score";
    $("save-score-btn").disabled = false;
    $("player-name").value = "";

    // 9. Transition screens
    $("setup-screen").classList.add("hidden");
    $("question-screen").classList.remove("hidden");
    window.scrollTo(0, 0);

    // 10. Start the global timer using setInterval
    clearInterval(timerInterval);
    timerInterval = setInterval(function () {
        totalSeconds++;
        updateTimerDisplay();
    }, 1000); // Runs every second

    questionStartTime = 0;

    // 11. Display the first question
    showQuestion(0);
}

/**
 * shuffleArray
 * Fisher-Yates shuffle - returns a new shuffled copy of the array.
 * https://www.geeksforgeeks.org/dsa/shuffle-a-given-array-using-fisher-yates-shuffle-algorithm/
 */
function shuffleArray(arr) {
    var copy = arr.slice(); // don't mutate the original
    for (var i = copy.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

/**
 * updateTimerDisplay
 * Formats totalSeconds as MM:SS and writes it to the timer element.
 */
function updateTimerDisplay() {
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    var minStr = (mins < 10) ? "0" + mins : "" + mins;
    var secStr = (secs < 10) ? "0" + secs : "" + secs;
    $("timer-display").textContent = minStr + ":" + secStr;
}


/**
 * showQuestion
 * Renders a single question and its four radio-button options.
 * Options are dynamically created elements, so addEventListener
 * is used on them.
 */
function showQuestion(index) {
    var question = currentQuestions[index];
    questionStartTime = totalSeconds; // mark when this question began

    // Progress indicator
    $("progress-text").textContent = "Question " + (index + 1) + " of " + currentQuestions.length;

    // Category + difficulty badge
    $("category-badge").textContent = question.category + " | " + question.difficulty;

    // Question text
    $("question-text").textContent = question.question;

    // Build the four answer options dynamically
    var container = $("options-container");
    container.innerHTML = ""; // clear previous options

    question.options.forEach(function (optionText, i) {
        // Each option is a <label> wrapping a hidden radio + visible text span
        var label = document.createElement("label");
        label.className = "quiz-option";
        // Template literal to build the inner HTML
        label.innerHTML = `
            <input type="radio" name="answer" value="${i}" class="quiz-radio">
            <span class="option-letter">${String.fromCharCode(65 + i)}</span>
            <span class="option-text">${optionText}</span>
        `;

        // addEventListener because this element was just created
        label.addEventListener("click", function () {
            // Remove 'selected' from all options, then add it to the clicked one
            document.querySelectorAll(".quiz-option").forEach(function (opt) {
                opt.classList.remove("selected");
            });
            label.classList.add("selected");
        });

        container.appendChild(label);
    });

    // Change the Next button label on the final question
    if (index === currentQuestions.length - 1) {
        $("next-btn").textContent = "Finish Quiz";
    } else {
        $("next-btn").textContent = "Next \u2192";
    }
}

/**
 * nextQuestion
 * Validates that an answer has been selected, records it,
 * checks correctness, then either advances or ends the quiz.
 */
function nextQuestion() {
    var selected = document.querySelector("input[name='answer']:checked");

    if (!selected) {
        alert("Please select an answer before continuing.");
        return;
    }

    var answerIndex = parseInt(selected.value, 10);
    var question = currentQuestions[currentIndex];

    // Record time spent on this question
    questionTimes.push(totalSeconds - questionStartTime);

    // Store the player's answer
    userAnswers.push(answerIndex);

    // Check correctness
    if (answerIndex === question.correctIndex) {
        score++;
    }

    currentIndex++;

    if (currentIndex >= currentQuestions.length) {
        // Quiz is finished - stop the timer and show results
        clearInterval(timerInterval);
        showResults();
    } else {
        showQuestion(currentIndex);
    }
}

/**
 * showResults
 * Called after the last question AND when returning from review.
 * Shows the score, time stats, category breakdown table, and
 * the leaderboard.
 */
function showResults() {
    // Hide other screens, reveal results
    $("question-screen").classList.add("hidden");
    $("review-screen").classList.add("hidden");
    $("results-screen").classList.remove("hidden");
    window.scrollTo(0, 0);

    var total = currentQuestions.length;
    var percentage = (score / total) * 100;

    // Score fraction
    $("score-display").textContent = score + " / " + total;

    // Percentage - .toFixed(2) as required
    $("percentage-display").textContent = percentage.toFixed(2) + "%";

    // Total time
    $("total-time-display").textContent = totalSeconds + " second(s)";

    // Average time per question - .toFixed(2)
    var avgTime = (total > 0) ? (totalSeconds / total) : 0;
    $("avg-time-display").textContent = avgTime.toFixed(2) + " second(s)";

    // Apply colour class to the percentage
    var percentageElement = $("percentage-display");
    percentageElement.className = ""; // reset
    if (percentage >= 70) {
        percentageElement.className = "score-good";
    } else if (percentage >= 40) {
        percentageElement.className = "score-ok";
    } else {
        percentageElement.className = "score-bad";
    }

    // Build the category breakdown table using createElement/appendChild
    buildCategoryTable();

    // Render the leaderboard
    displayLeaderboard();
}

/**
 * buildCategoryTable
 * Loops through currentQuestions to tally results per category,
 * then builds an HTML table using only createElement/appendChild.
 */
function buildCategoryTable() {
    // Build a plain object to hold totals per category
    var breakdown = {};

    currentQuestions.forEach(function (question, questionIndex) {
        // Ensure category exists in breakdown befor incrementing (avoids undefined error)
        if (!breakdown[question.category]) {
            breakdown[question.category] = { attempted: 0, correct: 0 };
        }
        // Count attempts (Every questions counts as attempted)
        breakdown[question.category].attempted++;
        // Count correct answers
        if (userAnswers[questionIndex] === question.correctIndex) {
            breakdown[question.category].correct++;
        }
    });

    var container = $("category-breakdown");
    container.innerHTML = ""; // clear any previous table

    var table = document.createElement("table");
    table.className = "w3-table w3-bordered quiz-breakdown-table";

    // --- Table head ---
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    headRow.className = "breakdown-header";

    // Builds table header
    ["Category", "Attempted", "Correct", "Score %"].forEach(function (label) {
        var th = document.createElement("th");
        th.textContent = label;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // --- Table body ---
    var tbody = document.createElement("tbody");

    // get category keys from breakdown object and loop through them
    // https://www.w3schools.com/jsref/jsref_object_keys.asp
    Object.keys(breakdown).forEach(function (cat) {
        
        // Access data for that category on each iterration
        var data = breakdown[cat];

        var categoryPercentage = (data.correct / data.attempted) * 100;
        var row = document.createElement("tr");

        // Colour-code the row based on performance
        if (categoryPercentage >= 70) {
            row.className = "row-good";
        } else if (categoryPercentage >= 40) {
            row.className = "row-ok";
        } else {
            row.className = "row-bad";
        }

        var tdCat = document.createElement("td");
        tdCat.textContent = cat;

        var tdAtt = document.createElement("td");
        tdAtt.textContent = data.attempted;

        var tdCor = document.createElement("td");
        tdCor.textContent = data.correct;

        var tdPct = document.createElement("td");
        tdPct.textContent = categoryPercentage.toFixed(2) + "%";

        row.appendChild(tdCat);
        row.appendChild(tdAtt);
        row.appendChild(tdCor);
        row.appendChild(tdPct);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

/**
 * showReview
 * Builds a card for each question showing the correct answer
 * and the player's choice, with green/red background.
 */
function showReview() {
    $("results-screen").classList.add("hidden");
    $("review-screen").classList.remove("hidden");
    window.scrollTo(0, 0);

    var container = $("review-container");
    container.innerHTML = "";

    currentQuestions.forEach(function (question, questionIndex) {
        var userAns = userAnswers[questionIndex];
        var correct = (userAns === question.correctIndex);

        // Outer card - green if correct, red if wrong
        var card = document.createElement("div");
        card.className = "review-card " + (correct ? "review-correct" : "review-wrong");

        // Question heading
        var qHeading = document.createElement("p");
        qHeading.className = "review-question";
        qHeading.innerHTML = `<strong>Q${questionIndex + 1}:</strong> ${question.question}`;

        // Category / difficulty tag
        var tag = document.createElement("p");
        tag.className = "review-tag";
        tag.textContent = question.category + " | " + question.difficulty;

        card.appendChild(qHeading);
        card.appendChild(tag);

        // Options list - each option styled based on whether it's correct/wrong
        var ul = document.createElement("ul");
        ul.className = "review-options";

        question.options.forEach(function (option, optionIndex) {
            var li = document.createElement("li");
            li.textContent = option;

            if (optionIndex === question.correctIndex) {
                li.className = "review-opt-correct";
                li.textContent += " \u2713"; // ✓
            } else if (optionIndex === userAns && !correct) {
                li.className = "review-opt-wrong";
                li.textContent += " \u2717 (your answer)"; // ✗
            }

            // style.backgroundColor is set directly as required
            if (optionIndex === question.correctIndex) {
                li.style.backgroundColor = "rgba(86, 201, 107, 0.15)";
                li.style.color = "#6ee08a";
            } else if (optionIndex === userAns && !correct) {
                li.style.backgroundColor = "rgba(255, 107, 107, 0.15)";
                li.style.color = "#ff8080";
            }

            ul.appendChild(li);
        });

        card.appendChild(ul);

        // Verdict line
        var verdict = document.createElement("p");
        verdict.className = "review-verdict";
        if (correct) {
            verdict.textContent = "Correct!";
            verdict.style.color = "#6ee08a";
        } else {
            verdict.textContent = "Correct answer: " + question.options[question.correctIndex];
            verdict.style.color = "#ff8080";
        }
        card.appendChild(verdict);

        container.appendChild(card);
    });
}

/**
 * Leaderboard helpers
 * initLeaderboard - loads localStorage with Overwatch-themed defaults
 * if no data is stored yet.
 * https://www.w3schools.com/jsref/prop_win_localstorage.asp
 */
function initLeaderboard() {
    if (!localStorage.getItem("owQuizLeaderboard")) {
        var defaults = [
            { name: "Soldier76",  score: 9,  total: 10, percentage: 90.00, totalTime: 145, date: "01/03/2026" },
            { name: "Tracer",     score: 8,  total: 10, percentage: 80.00, totalTime: 112, date: "15/02/2026" },
            { name: "D.Va",       score: 10, total: 10, percentage: 100.00, totalTime: 160, date: "28/02/2026" },
            { name: "Mei",        score: 7,  total: 10, percentage: 70.00, totalTime: 198, date: "20/02/2026" },
            { name: "Reinhardt",  score: 6,  total: 10, percentage: 60.00, totalTime: 230, date: "05/03/2026" }
        ];
        // JSON.stringify converts the array to a string for localStorage
        localStorage.setItem("owQuizLeaderboard", JSON.stringify(defaults));
    }
}

// getLeaderboard - reads and JSON.parses the stored array
function getLeaderboard() {
    var storedJson = localStorage.getItem("owQuizLeaderboard");
    return storedJson ? JSON.parse(storedJson) : [];
}

// saveToLeaderboard - validates name input, creates an entry, saves it
function saveToLeaderboard() {
    var playerName = $("player-name");
    var name = playerName.value.trim();

    if (name === "") {
        alert("Please enter your name to save your score.");
        return;
    }

    var total = currentQuestions.length;
    var percentage = parseFloat(((score / total) * 100).toFixed(2));

    var entry = {
        name: name,
        score: score,
        total: total,
        percentage: percentage,
        totalTime: totalSeconds,
        date: new Date().toLocaleDateString("en-GB")
    };

    // Add player data to leaderboard
    var leaderboard = getLeaderboard();
    leaderboard.push(entry);
    localStorage.setItem("owQuizLeaderboard", JSON.stringify(leaderboard));
    
    // Update screen
    playerName.value = "";
    $("save-score-btn").textContent = "Saved!";
    $("save-score-btn").disabled = true;

    displayLeaderboard();
}

/**
 * displayLeaderboard 
 * sorts the array then builds the table with createElement/appendChild.
 * Highest % wins; fastest time breaks ties.
 */
function displayLeaderboard() {
    var leaderboard = getLeaderboard();

    // Sort by highest percentage first
    leaderboard.sort(function (entryA, entryB) {
        if (entryB.percentage !== entryA.percentage) {
            return entryB.percentage - entryA.percentage;
        }
        // Sort by fasted time if percentages are equal
        return entryA.totalTime - entryB.totalTime;
    });

    var container = $("leaderboard-table-container");
    // Exit if container doesnt exiust
    if (!container) return;
    container.innerHTML = "";

    var table = document.createElement("table");
    table.className = "w3-table w3-bordered quiz-leaderboard-table";

    // Header row
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    headRow.className = "breakdown-header";

    // Build table header
    ["#", "Name", "Score", "Percentage", "Time (s)", "Date"].forEach(function (h) {
        var th = document.createElement("th");
        th.textContent = h;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Data rows
    var tbody = document.createElement("tbody");

    leaderboard.forEach(function (entry, i) {
        var row = document.createElement("tr");
        if (i === 0) row.className = "leaderboard-top"; // gold highlight for 1st place

        var cells = [
            i + 1,
            entry.name,
            entry.score + " / " + entry.total,
            entry.percentage.toFixed(2) + "%",
            entry.totalTime,
            entry.date
        ];

        cells.forEach(function (val) {
            var td = document.createElement("td");
            td.textContent = val;
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

// clearLeaderboard - confirms with alert, wipes localStorage, re-seeds defaults
function clearLeaderboard() {
    if (confirm("Are you sure you want to clear the leaderboard?\nThis will reset to the default entries and cannot be undone.")) {
        localStorage.removeItem("owQuizLeaderboard");
        initLeaderboard();
        displayLeaderboard();
        alert("Leaderboard cleared and reset to defaults.");
    }
}

/**
 * playAgain
 * Resets all state and returns to the setup screen.
 */
function playAgain() {
    clearInterval(timerInterval);

    // Hide all game screens
    $("results-screen").classList.add("hidden");
    $("review-screen").classList.add("hidden");
    $("question-screen").classList.add("hidden");

    // Show the setup screen
    $("setup-screen").classList.remove("hidden");
    window.scrollTo(0, 0);

    // Reset global state
    currentQuestions = [];
    currentIndex = 0;
    score = 0;
    userAnswers = [];
    questionTimes = [];
    totalSeconds = 0;

    // Reset UI elements that carry over between games
    $("timer-display").textContent = "00:00";
    $("save-score-btn").textContent = "Save Score";
    $("save-score-btn").disabled = false;
    $("player-name").value = "";
    $("num-error").classList.add("hidden");
}
