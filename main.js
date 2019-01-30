const dom = require('xmldom').DOMParser;
const xpath = require('xpath');
// const canvas = require('canvas-wrapper');
const canvas = require('canvas-api-wrapper');
const asyncLib = require('async');
const {
    promisify
} = require('util');
const asyncEach = promisify(asyncLib.each);

/******************
 * Todo:
 * 
 * - Get quiz question properties
 * - Delete quiz question
 * - Create new quiz question with correct answers, dropdown and position
 * 
 ******************/

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
        /**********************************************
         * getXML
         * @param {Array} quizzes
         * 
         * This returns the xml portion that lives inside
         * the dom property of each quiz as an array.
         *********************************************/
        function getXML(quizzes) {
            return quizzes.map(quiz => quiz.dom.xml());
        }

        /**********************************************
         * updateQuestions
         * @param {Array} questions
         * @param {Array} answers
         * 
         * This function creates a new property in each
         * object in the array to contain the question
         * id of the question it is correct for.
         *********************************************/
        async function updateQuestions(questions, answers) {
            // asyncEach(answers, async answer => {
            //     let answersArray = [];
            //     asyncEach(questions, async question => {
            //         asyncEach(question.questions, async qQuestion => {
            //             if (qQuestion.id === answer.questionId && answer.answer === 'D2L_Correct') {
            //                 asyncEach(question.answers, a => {
            //                     if (a.id === answer.answerId) {
            //                         answersArray.push({
            //                             'id': answer.answerId,
            //                             'text': a.answer
            //                         });
            //                     }
            //                 });

            //                 if (answersArray.length > 0) qQuestion.matchAnswerId = answersArray
            //             }
            //         });
            //     });
            // });

            return questions;
        }

        /**********************************************
         * identifyAnswers
         * @param {dom} doc
         * 
         * This builds an object array of all the answers
         * that contains the question it is for, the 
         * answer id and whether it is correct or not, 
         * which is done through either D2L_Correct or
         * D2L_Incorrect.
         *********************************************/
        function identifyAnswers(doc) {
            // respcondition node list
            let respconditionNodes = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../resprocessing/respcondition';

            // get node list
            let quizAnswersArray = xpath.evaluate(respconditionNodes, doc, null, xpath.XPathResult.ANY_TYPE, null);
            let answers = [];

            //start the iteration process
            node = quizAnswersArray.iterateNext();

            //iterate through all of the correct/incorrect portion of the xml
            while (node) {
                let questionIDSelector = '//varequal/@respident';
                let answerIDSelector = '//varequal';
                let answerSelector = '//setvar/@varname';

                let newDoc = new dom().parseFromString(node.toString());

                //get the qId and make sure that it is valid 
                let qId = xpath.select(questionIDSelector, newDoc)[0];

                //ensure that we get the ID instead of crap
                if (qId) {
                    qId = qId.textContent
                    let aId = xpath.select(answerIDSelector, newDoc)[0].textContent;
                    let answer = xpath.select(answerSelector, newDoc)[0].textContent;

                    //save state in array
                    let obj = {
                        'questionId': qId,
                        'answerId': aId,
                        'answer': answer
                    };

                    answers.push(obj);
                }


                node = quizAnswersArray.iterateNext();
            }

            //remove the bad parts that the XPath may have returned
            return answers.filter(ele => ele.questionId.includes('QUES_'));
        }

        /**********************************************
         * extraction
         * @param {String} word
         * 
         * This function basically retrieves the question
         * and answers from a string that was returned
         * by XPath.
         *********************************************/
        function extraction(word) {
            let phrase = word.replace(/<\/p>/g, '<>').replace(/<p>/g, '').split('<>').filter(ele => ele !== '');
            let q = phrase[0];
            phrase.shift(0);

            return {
                question: q,
                answers: phrase
            }
        }

        /**********************************************
         * createObj
         * @param {Array} arr
         * @param {dom} doc
         * 
         * This forms the array of objects where it
         * holds the matching questions and possible 
         * answers for those matching questions.
         * 
         * This is what the end results look like:
         * [
         *      {
         *          questions: [
         *              "A poor fool suffering from his mid-life crisis.",
         *              "The state bird of Michigan",
         *              "Your face"
         *          ],
         *          answers: ["Batman", "Robin"]
         *      },
         *      {
         *          questions: [
         *              "Jello"
         *          ],
         *          answers: ["Consumable plastic", "See-through food", "a hairbrush"]
         *      },
         *      ...
         *  ] 
         *********************************************/
        function createObj(arr, doc) {
            let theSet = [];

            //build an unique list of all the answers for the question
            arr.forEach(ele => {
                let flag = false;
                for (let theSetElement of theSet)
                    if (theSetElement.equals(ele.answers)) flag = true;
                if (!flag) theSet.push(ele.answers);
            });

            //match the matching questions to the their possible answers

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

                // retrieving the id
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

        /**********************************************
         * getLabels
         * @param {Array} xmlData
         * 
         * This function acts as a driver for all of the
         * XML parsing process to identify which answers
         * are correct for any of the matching questions.
         *********************************************/
        async function getLabels(xmlData) {
            const xpathQuizTitleSelector = '//assessment/@title';
            const xpathQuestionTextSelector = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/material/mattext';

            // gets all of the questions and answers
            const xpathAnswersTextSelector = '//fieldlabel[text()="qmd_questiontype"]/../fieldentry[text()="Matching"]/../../../../presentation/flow/response_grp';

            return [await asyncEach(xmlData, async xml => {
                let doc = new dom().parseFromString(xml);

                // let quizTitle = xpath.select(xpathQuizTitleSelector, doc)[0].value;
                let quizQuestionsArray = xpath.select(xpathAnswersTextSelector, doc)
                    .map(node => (node) ? node.textContent : '');

                let questions = createObj(quizQuestionsArray.map(nodie => extraction(nodie)), doc);
                let answers = identifyAnswers(doc);

                // let finalArray = JSON.stringify(await updateQuestions(questions, answers));

                return {
                    'questions': questions,
                    'answerKey': answers
                };
            })];
        };

        async function findCorrectMatch(nodes, answerText) {

        }

        async function retrieveQuizzes() {
            return canvas.get(`/api/v1/courses/${course.info.canvasOU}/quizzes`);
        }

        async function fixQuizzes() {
            let quizzes = await retrieveQuizzes();
            let questionTypes = [
                'matching_question'
            ];
            // let nodes = await getLabels();

            await asyncEach(quizzes, async quiz => {
                let questions = await canvas.get(`/api/v1/courses/${course.info.canvasOU}/quizzes/${quiz.id}/questions`);

                await asyncEach(questions, async question => {
                    let answersArray = [];
                    let matchesArray = [];
                    if (questionTypes.includes(question.question_type)) {
                        let answers = question.answers;
                        let matches = question.matches;

                        await asyncEach(answers, async answer => {
                            let newLeft = answer.right;
                            let newRight = answer.left;

                            answersArray.push({
                                ...(newLeft && {
                                    'text': newLeft
                                }),
                                'id': answer.id,
                                ...(answer.match_id && {
                                    'match_id': answer.match_id
                                }),
                                ...(newLeft && {
                                    'left': newLeft
                                }),
                                'right': newRight
                            });
                        });

                        await asyncEach(matches, async match => {
                            await asyncEach(answersArray, async a => {
                                if (a.match_id == match.match_id) {
                                    matchesArray.push({
                                        'match_id': match.match_id,
                                        'text': a.right
                                    });
                                }
                            });
                        });
                    }

                    await canvas.put(`/api/v1/courses/${course.info.canvasOU}/quizzes/${quiz.id}/questions/${question.id}`, {
                        'question': {
                            'answers': answersArray,
                            'matches': matchesArray
                        }
                    });
                    // console.log('---------------------------------------------');
                    // console.log('Quiz Title: ', quiz.title);
                    // console.log('Answers: ', answersArray);
                    // console.log('Matches: ', matchesArray);
                    // console.log('---------------------------------------------');
                });
            });
        }

        await fixQuizzes();
        stepCallback(null, course);

        // /*********************************************
        //  * getQuizzes
        //  * Retrieves a list of quizzes in a course and
        //  * builds an object array based on each quiz
        //  **********************************************/
        // function getQuizzes(getQuizzesCallback) {
        //     canvas.getQuizzes(course.info.canvasOU, (getQuizzesErr, quizList) => {
        //         if (getQuizzesErr) {
        //             getQuizzesCallback(getQuizzesErr);
        //             return;
        //         } else {
        //             course.message(`Successfully retrieved ${quizList.length} quizzes.`);
        //             getQuizzesCallback(null, quizList);
        //             return;
        //         }
        //     }, (err) => {
        //         if (err) {
        //             getQuizzesCallback(err);
        //             return;
        //         }
        //     });
        // }

        // /*********************************************
        //  * filterQuizQuestions
        //  * Goes through the question and works with
        //  * the match questions.
        //  **********************************************/
        // function filterQuizQuestions(quizzes, filterQuizQuestionsCallback) {
        //     // question types we want to work with
        //     var questionTypes = [
        //         'matching_question'
        //     ];

        //     asyncLib.eachSeries(quizzes, (quiz, eachSeriesCallback) => {
        //         //these doesn't need to be reset for each question but it needs to be reset for each quiz
        //         var quizTitle = quiz.title;
        //         var isMultipleAnswersSame = false;
        //         var avoidDuplicateQuestions = [];
        //         var distractorsArray = [];

        //         canvas.getQuizQuestions(course.info.canvasOU, quiz.id, (getErr, questions) => {
        //             if (getErr) {
        //                 filterQuizQuestionsCallback(getErr);
        //                 return;
        //             } else {
        //                 // go through every quiz question
        //                 asyncLib.each(questions, (question, eachCallback) => {
        //                     // we do this to ensure that the arrays and string are cleared every time we execute this function
        //                     var answersArray = []; // for answers array object in QuizQuestion
        //                     var matchingArray = []; // array of objects for QuizQuestion
        //                     var distractors = ''; // string for all incorrect answers in the dropdown
        //                     // var warn = false;            // for tap/testing

        //                     // we have found a question that is part of questionType array
        //                     // we switch the question and answer here
        //                     if (questionTypes.includes(question.question_type)) {
        //                         question.answers.forEach(answer => {
        //                             /* if there are more questions than answers, this is necessary
        //                             so we don't accidentally create blank question(s) */
        //                             if (answer.right != null) {
        //                                 // multiple questions have the same answer
        //                                 if (question.answers.length < question.matches.length) {

        //                                     // set to true for future warning
        //                                     isMultipleAnswersSame = true;

        //                                     //ensure that we get ALL of the options in the dropdown
        //                                      question.answers.filter(answer => {
        //                                          if (!distractorsArray.includes(answer.left)) {
        //                                              distractors += `${answer.left}\n`;
        //                                              distractorsArray.push(answer.left);
        //                                          }
        //                                      });

        //                                     // for matching part of QuizQuestion object
        //                                     var newMatchObj = {
        //                                         'match_id': answer.match_id, // id for correct match
        //                                         'text': answer.left // part of dropdown for the correct answer
        //                                     };

        //                                     //for answers part of QuizQuestion object
        //                                     for (i in question.matches) {
        //                                         //ensure that we avoid duplicate questions
        //                                         if (!avoidDuplicateQuestions.includes(question.matches[i].text)) {
        //                                             var obj = {
        //                                                 'answer_text': answer.text, //text of answer
        //                                                 'id': answer.id, //id of answer
        //                                                 'answer_match_left': question.matches[i].text, //the swapping happens here
        //                                                 'answer_match_right': newMatchObj.text //the swapping ALSO happens here
        //                                             };

        //                                             answersArray.push(obj);
        //                                             matchingArray.push(newMatchObj);
        //                                             avoidDuplicateQuestions.push(question.matches[i].text);
        //                                         }
        //                                     }
        //                                     //each question has an individual answer.
        //                                 } else {
        //                                     //for matching part of QuizQuestion object
        //                                     var newMatchObj = {
        //                                         'match_id': answer.match_id, //id for correct match
        //                                         'text': answer.left //part of dropdown for the correct answer
        //                                     };

        //                                     //for answers part of QuizQuestion object
        //                                     var obj = {
        //                                         'answer_text': answer.text, //text of answer
        //                                         'id': answer.id, //id of answer
        //                                         'answer_match_left': answer.right, //the swapping happens here
        //                                         'answer_match_right': newMatchObj.text //the swapping ALSO happens here
        //                                     };

        //                                     //new lines are delimiter
        //                                     distractors += `${answer.left}\n`; //build the string for options that are not correct answers
        //                                     matchingArray.push(newMatchObj); //for matches object in QuizQuestion
        //                                     answersArray.push(obj); //for answers object in QuizQuestion
        //                                 }
        //                             } else {
        //                                 distractors += `${answer.left}\n`;
        //                             }
        //                         });

        //                         //output error if bool is true
        //                         if (isMultipleAnswersSame) {
        //                             //throw warning so humans can check out the quiz to ensure that there is no bugs and make sure 
        //                             //that all of the answers for the questions are correct.
        //                             course.warning(`You will want to look at quiz: ${quizTitle} at (matching) question ${question.position}. Multiple questions have the same answer.`);
        //                             isMultipleAnswersSame = false;
        //                         }

        //                         //the question and answers has been switched. let's update the question on the quiz while we are at it
        //                         canvas.put(`/api/v1/courses/${course.info.canvasOU}/quizzes/${quiz.id}/questions/${question.id}`, {
        //                                 'question': {
        //                                     'answers': answersArray,
        //                                     'matching': matchingArray,
        //                                     'matching_answer_incorrect_matches': distractors
        //                                 },
        //                             },
        //                             (putErr, results) => {
        //                                 if (putErr) {
        //                                     eachCallback(putErr);
        //                                     return;
        //                                 } else {
        //                                     course.log('Quiz Question Swapping', {
        //                                         'ID': question.id,
        //                                         'Title': question.question_name
        //                                     });

        //                                     /*course.info.matchingQuestionsChanged.push({
        //                                         'id': q.id,
        //                                         'warning': warn
        //                                     });*/
        //                                     eachCallback(null);
        //                                 }
        //                             });
        //                     }
        //                 });

        //                 eachSeriesCallback(null);
        //             }
        //         });
        //     }, (err) => {
        //         if (err) {
        //             filterQuizQuestionsCallback(err);
        //             return;
        //         } else {
        //             course.message('Successfully filtered all quiz questions');
        //             filterQuizQuestionsCallback(null);
        //             return;
        //         }
        //     });
        // }

        // var functions = [
        //     getQuizzes,
        //     filterQuizQuestions
        // ];

        // /************************************************************
        //  *                         START HERE                        *
        //  ************************************************************/
        // // asyncLib.waterfall(functions, (waterfallErr, results) => {
        // //     if (waterfallErr) {
        // //         course.error(waterfallErr);
        // //         stepCallback(null, course);
        // //     } else {
        // //         course.message('Successfully completed match-question-answers');
        // //         stepCallback(null, course);
        // //     }
        // // });
        // let quizzes = course.content.filter(file => file.name.includes('quiz_d2l_'));
        // let nodes = await getLabels(getXML(quizzes));

        // stepCallback(null, course);
    })();
};