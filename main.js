/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
const canvas = require('canvas-wrapper');
const asyncLib = require('async');
const cheerio = require('cheerio');

module.exports = (course, stepCallback) => {
    //course.newInfo('matchingQuestionsChanged', []);

    /*********************************************
     * getQuizzes
     * Retrieves a list of quizzes in a course and
     * builds an object array based on each quiz
     **********************************************/
    function getQuizzes(functionCallback) {
        canvas.getQuizzes(course.info.canvasOU, (getErr, quizList) => {
            if (getErr) {
                functionCallback(getErr);
                return;
            } else {
                course.message(`Successfully retrieved ${quizList.length} quizzes.`);
                functionCallback(null, quizList);
                return;
            }
        }, (err) => {
            if (err) {
                functionCallback(err);
                return;
            }
        });
    }

    /*********************************************
     * filterQuizQuestions
     * Goes through the question and works with
     * the match questions.
     **********************************************/
    function filterQuizQuestions(quizzes, functionCallback) {
        // question types we want to work with
        var questionTypes = [
            'matching_question'
        ];

        asyncLib.eachSeries(quizzes, (quiz, eachCallback) => {
            //these doesn't need to be reset for each question but it needs to be reset for each quiz
            var quizTitle = quiz.title;
            var isMultipleAnswersSame = false;
            var avoidDuplicateQuestions = [];
            var distractorsArray = []; 

            canvas.getQuizQuestions(course.info.canvasOU, quiz.id, (getErr, questions) => {
                if (getErr) {
                    functionCallback(getErr);
                    return;
                } else {
                    // go through every quiz question
                    asyncLib.each(questions, (question, innerEachCallBack) => {
                        // we do this to ensure that the arrays and string are cleared every time we execute this function
                        var answersArray = [];          // for answers array object in QuizQuestion
                        var matchingArray = [];         // array of objects for QuizQuestion
                        var distractors = '';           // string for all incorrect answers in the dropdown
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
                                            'match_id': answer.match_id,    // id for correct match
                                            'text': answer.left             // part of dropdown for the correct answer
                                        };

                                        //for answers part of QuizQuestion object
                                        for (i in question.matches) {
                                            //ensure that we avoid duplicate questions
                                            if (!avoidDuplicateQuestions.includes(question.matches[i].text)) {
                                                var obj = {
                                                    'answer_text': answer.text,                     //text of answer
                                                    'id': answer.id,                                //id of answer
                                                    'answer_match_left': question.matches[i].text,  //the swapping happens here
                                                    'answer_match_right': newMatchObj.text          //the swapping ALSO happens here
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
                                            'match_id': answer.match_id,    //id for correct match
                                            'text': answer.left             //part of dropdown for the correct answer
                                        };

                                        //for answers part of QuizQuestion object
                                        var obj = {
                                            'answer_text': answer.text,             //text of answer
                                            'id': answer.id,                        //id of answer
                                            'answer_match_left': answer.right,      //the swapping happens here
                                            'answer_match_right': newMatchObj.text  //the swapping ALSO happens here
                                        };

                                        //new lines are delimiter
                                        distractors += `${answer.left}\n`;  //build the string for options that are not correct answers
                                        matchingArray.push(newMatchObj);    //for matches object in QuizQuestion
                                        answersArray.push(obj);             //for answers object in QuizQuestion
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
                                        innerEachCallBack(putErr);
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
                                        innerEachCallBack(null);
                                    }
                                });
                        }
                    });

                    eachCallback(null);
                }
            });
        }, (err) => {
            if (err) {
                functionCallback(err);
                return;
            } else {
                course.message('Successfully filtered all quiz questions');
                functionCallback(null);
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
    asyncLib.waterfall(functions, (waterfallErr, results) => {
        if (waterfallErr) {
            course.error(waterfallErr);
            stepCallback(null, course);
        } else {
            course.message('Successfully completed match-question-answers');
            stepCallback(null, course);
        }
    });
};