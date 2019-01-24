const dom = require('xmldom').DOMParser;
const xpath = require('xpath');
const canvas = require('canvas-wrapper');
const asyncLib = require('async');
const {
    promisify
} = require('util');
const asyncEach = promisify(asyncLib.each);

//https://stackoverflow.com/a/14853974
Array.prototype.equals = function (array) {
    // something went bad here
    if (!array || this.length != array.length) return false;

    //element checking
    for (var i = 0; i < this.length; i++) {
        // recursively checking inner arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            if (!this[i].equals(array[i])) {
                return false;
            }
        } else if (this[i] != array[i]) {
            return false;
        }
    }

    return true;
}

module.exports = (course, stepCallback) => {
    (async () => {
        function getXML(quizzes) {
            return quizzes.map(quiz => quiz.dom.xml());
        }

        function extraction(word) {
            let phrase = word.replace(/<\/p>/g, '<>').replace(/<p>/g, '').split('<>').filter(ele => ele !== '');
            let q = phrase[0];
            phrase.shift(0);

            return {
                question: q,
                answers: phrase
            }
        }

        function createObj(arr, doc) {
            let theSet = [];

            arr.forEach(ele => {
                let flag = false;
                for (let theSetElement of theSet)
                    if (theSetElement.equals(ele.answers)) flag = true;
                if (!flag) theSet.push(ele.answers);
            });

            let questions = [];
            theSet.forEach(ele => {
                let temp = []
                let answer = '';

                arr.forEach(arrayElement => {
                    if (arrayElement.answers.equals(ele)) {
                        temp.push(arrayElement);
                        answer = ele;
                    }
                });

                let a = answer.map(ele => {
                    let updatedEle = ele.replace('&nbsp;', ' ');

                    let selector = `//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/response_grp//mattext[text()="<p>${ele}</p>"]/../../../@ident`;
                    let id = xpath.select(selector, doc)[0].textContent;

                    return {
                        'answer': updatedEle,
                        'id': id
                    }
                });

                let q = temp.map(ele => {
                    let selector = `//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/response_grp/material/mattext[text()="<p>${ele.question}</p>"]/../../@respident`
                    let id = xpath.select(selector, doc)[0].textContent;

                    return {
                        'question': ele.question,
                        'id': id
                    }
                });

                questions.push({
                    'questions': q,
                    'answers': a
                });
            });

            return questions;
        }

        async function getLabels(xmlData) {
            const xpathQuizTitleSelector = '//assessment/@title';
            const xpathQuestionTextSelector = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/material/mattext';

            // gets all of the questions and answers
            const xpathAnswersTextSelector = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/response_grp';

            // gets all of the QUES IDs
            const xpathID = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/response_grp/render_choice/flow_label/response_label/@ident';

            // gets the QUES_ID for a certain question
            // '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/response_grp/material/mattext[text()="<p>A poor fool suffering from his mid-life crisis.</p>"]/../../@respident'

            // number of questions with QUES_ID
            //'//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../@label'

            await asyncEach(xmlData, async xml => {
                let doc = new dom().parseFromString(xml);

                // let quizTitle = xpath.select(xpathQuizTitleSelector, doc)[0].value;
                let quizQuestionsArray = xpath.select(xpathAnswersTextSelector, doc)
                    .map(node => (node) ? node.textContent : '');

                let questions = createObj(quizQuestionsArray.map(nodie => extraction(nodie)), doc);
                console.log(JSON.stringify(questions));
            });
        };

        /*********************************************
         * getQuizzes
         * Retrieves a list of quizzes in a course and
         * builds an object array based on each quiz
         **********************************************/
        function getQuizzes(getQuizzesCallback) {
            canvas.getQuizzes(course.info.canvasOU, (getQuizzesErr, quizList) => {
                if (getQuizzesErr) {
                    getQuizzesCallback(getQuizzesErr);
                    return;
                } else {
                    course.message(`Successfully retrieved ${quizList.length} quizzes.`);
                    getQuizzesCallback(null, quizList);
                    return;
                }
            }, (err) => {
                if (err) {
                    getQuizzesCallback(err);
                    return;
                }
            });
        }

        /*********************************************
         * filterQuizQuestions
         * Goes through the question and works with
         * the match questions.
         **********************************************/
        function filterQuizQuestions(quizzes, filterQuizQuestionsCallback) {
            // question types we want to work with
            var questionTypes = [
                'matching_question'
            ];

            asyncLib.eachSeries(quizzes, (quiz, eachSeriesCallback) => {
                //these doesn't need to be reset for each question but it needs to be reset for each quiz
                var quizTitle = quiz.title;
                var isMultipleAnswersSame = false;
                var avoidDuplicateQuestions = [];
                var distractorsArray = [];

                canvas.getQuizQuestions(course.info.canvasOU, quiz.id, (getErr, questions) => {
                    if (getErr) {
                        filterQuizQuestionsCallback(getErr);
                        return;
                    } else {
                        // go through every quiz question
                        asyncLib.each(questions, (question, eachCallback) => {
                            // we do this to ensure that the arrays and string are cleared every time we execute this function
                            var answersArray = []; // for answers array object in QuizQuestion
                            var matchingArray = []; // array of objects for QuizQuestion
                            var distractors = ''; // string for all incorrect answers in the dropdown
                            // var warn = false;            // for tap/testing

                            // we have found a question that is part of questionType array
                            // we switch the question and answer here
                            if (questionTypes.includes(question.question_type)) {
                                question.answers.forEach(answer => {
                                    /* if there are more questions than answers, this is necessary
                                    so we don't accidentally create blank question(s) */
                                    if (answer.right != null) {
                                        // multiple questions have the same answer
                                        if (question.answers.length < question.matches.length) {

                                            // set to true for future warning
                                            isMultipleAnswersSame = true;

                                            //ensure that we get ALL of the options in the dropdown
                                            question.answers.filter(answer => {
                                                if (!distractorsArray.includes(answer.left)) {
                                                    distractors += `${answer.left}\n`;
                                                    distractorsArray.push(answer.left);
                                                }
                                            });

                                            // for matching part of QuizQuestion object
                                            var newMatchObj = {
                                                'match_id': answer.match_id, // id for correct match
                                                'text': answer.left // part of dropdown for the correct answer
                                            };

                                            //for answers part of QuizQuestion object
                                            for (i in question.matches) {
                                                //ensure that we avoid duplicate questions
                                                if (!avoidDuplicateQuestions.includes(question.matches[i].text)) {
                                                    var obj = {
                                                        'answer_text': answer.text, //text of answer
                                                        'id': answer.id, //id of answer
                                                        'answer_match_left': question.matches[i].text, //the swapping happens here
                                                        'answer_match_right': newMatchObj.text //the swapping ALSO happens here
                                                    };

                                                    answersArray.push(obj);
                                                    matchingArray.push(newMatchObj);
                                                    avoidDuplicateQuestions.push(question.matches[i].text);
                                                }
                                            }
                                            //each question has an individual answer.
                                        } else {
                                            //for matching part of QuizQuestion object
                                            var newMatchObj = {
                                                'match_id': answer.match_id, //id for correct match
                                                'text': answer.left //part of dropdown for the correct answer
                                            };

                                            //for answers part of QuizQuestion object
                                            var obj = {
                                                'answer_text': answer.text, //text of answer
                                                'id': answer.id, //id of answer
                                                'answer_match_left': answer.right, //the swapping happens here
                                                'answer_match_right': newMatchObj.text //the swapping ALSO happens here
                                            };

                                            //new lines are delimiter
                                            distractors += `${answer.left}\n`; //build the string for options that are not correct answers
                                            matchingArray.push(newMatchObj); //for matches object in QuizQuestion
                                            answersArray.push(obj); //for answers object in QuizQuestion
                                        }
                                    } else {
                                        distractors += `${answer.left}\n`;
                                    }
                                });

                                //output error if bool is true
                                if (isMultipleAnswersSame) {
                                    //throw warning so humans can check out the quiz to ensure that there is no bugs and make sure 
                                    //that all of the answers for the questions are correct.
                                    course.warning(`You will want to look at quiz: ${quizTitle} at (matching) question ${question.position}. Multiple questions have the same answer.`);
                                    isMultipleAnswersSame = false;
                                }

                                //the question and answers has been switched. let's update the question on the quiz while we are at it
                                canvas.put(`/api/v1/courses/${course.info.canvasOU}/quizzes/${quiz.id}/questions/${question.id}`, {
                                        'question': {
                                            'answers': answersArray,
                                            'matching': matchingArray,
                                            'matching_answer_incorrect_matches': distractors
                                        },
                                    },
                                    (putErr, results) => {
                                        if (putErr) {
                                            eachCallback(putErr);
                                            return;
                                        } else {
                                            course.log('Quiz Question Swapping', {
                                                'ID': question.id,
                                                'Title': question.question_name
                                            });

                                            /*course.info.matchingQuestionsChanged.push({
                                                'id': q.id,
                                                'warning': warn
                                            });*/
                                            eachCallback(null);
                                        }
                                    });
                            }
                        });

                        eachSeriesCallback(null);
                    }
                });
            }, (err) => {
                if (err) {
                    filterQuizQuestionsCallback(err);
                    return;
                } else {
                    course.message('Successfully filtered all quiz questions');
                    filterQuizQuestionsCallback(null);
                    return;
                }
            });
        }

        var functions = [
            getQuizzes,
            filterQuizQuestions
        ];

        /************************************************************
         *                         START HERE                        *
         ************************************************************/
        // asyncLib.waterfall(functions, (waterfallErr, results) => {
        //     if (waterfallErr) {
        //         course.error(waterfallErr);
        //         stepCallback(null, course);
        //     } else {
        //         course.message('Successfully completed match-question-answers');
        //         stepCallback(null, course);
        //     }
        // });
        let quizzes = course.content.filter(file => file.name.includes('quiz_d2l_'));
        let nodes = await getLabels(getXML(quizzes));

        stepCallback(null, course);
    })();
};