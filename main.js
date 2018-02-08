/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
const canvas = require('canvas-wrapper');
const asyncLib = require('async');

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
    function filterQuizQuestions(quizItems, functionCallback) {
        //question types we want to work with
        var questionTypes = [
            'matching_question'
        ];

        //reason for 3 is that we don't overload the server
        asyncLib.eachSeries(quizItems, (item, eachCallback) => {
            var quizTitle = item.title;
            var isMultipleAnswersSame = false;
            canvas.getQuizQuestions(course.info.canvasOU, item.id, (getErr, questions) => {
                if (getErr) {
                    functionCallback(getErr);
                    return;
                } else {
                    //go through every quiz question
                    asyncLib.each(questions, (question, innerEachCallBack) => {
                        //we do this to ensure that the arrays and string are cleared every time we execute this function
                        var answersArray = [];         //for answers array object in QuizQuestion
                        var matches = [];   //array of objects for QuizQuestion
                        var answers = ``;   //string for all incorrect answers in the dropdown
                        // var warn = false;   for tap/testing

                        //we have found a question that is part of questionType array
                        //we switch the question and answer here
                        if (questionTypes.includes(question.question_type)) {
                            question.answers.forEach(index => {
                                //if there are more questions than answers, this is necessary
                                //so we don't accidentally create blank question(s)
                                if (index.right != null) {
                                    //multiple questions have the same answer
                                    if (question.answers.length < question.matches.length) {
                                        // warn = true;

                                        //set to true for future warning
                                        isMultipleAnswersSame = true;

                                        //for matching part of QuizQuestion object
                                        var newObj = {
                                            'match_id': index.match_id,         //id for correct match
                                            'text': index.left                  //part of dropdown for the correct answer
                                        };

                                        //for answers part of QuizQuestion object
                                        for (i in question.matches) {
                                            var obj = {
                                                'answer_text': index.text,                  //text of answer
                                                'id': index.id,                             //id of answer
                                                'answer_match_left': question.matches[i].text,     //the swapping happens here
                                                'answer_match_right': newObj.text           //the swapping ALSO happens here
                                            };

                                            answersArray.push(obj);
                                            matches.push(newObj);
                                        }
                                    //each question has an individual answer.
                                    } else {
                                        //for matching part of QuizQuestion object
                                        var newObj = {
                                            'match_id': index.match_id,         //id for correct match
                                            'text': index.left                  //part of dropdown for the correct answer
                                        };

                                        //for answers part of QuizQuestion object
                                        var obj = {
                                            'answer_text':index.text,           //text of answer
                                            'id': index.id,                     //id of answer
                                            'answer_match_left': index.right,   //the swapping happens here
                                            'answer_match_right': newObj.text   //the swapping ALSO happens here
                                        };

                                        //new lines are delimiter
                                        answers += `${index.left}\n`;           //build the string for options that are not correct answers
                                        matches.push(newObj);                   //for matches object in QuizQuestion
                                        answersArray.push(obj);                            //for answers object in QuizQuestion
                                    }
                                } else {
                                    answers += `${index.left}\n`;
                                }
                            });

                            //output error if bool is true
                            if (isMultipleAnswersSame) {
                                //throw warning so humans can check out the quiz to ensure that there is no bugs
                                course.warning(`You may want to look at quiz: ${quizTitle} at (matching) question ${question.position}. Multiple questions have the same answer.`);
                                isMultipleAnswersSame = false;
                            }

                            //the question and answers has been switched. let's update the question on the quiz while we are at it
                            canvas.put(`/api/v1/courses/${course.info.canvasOU}/quizzes/${item.id}/questions/${question.id}`, {
                                'question': {
                                    'answers': answersArray,
                                    'matching': matches,
                                    'matching_answer_incorrect_matches': answers
                                },
                            },
                            (putErr, results) => {
                                if (putErr) {
                                    innerEachCallBack(putErr);
                                    return;
                                } else {
                                    course.log(`Quiz Question Swapping`, {
                                        'ID': question.id
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
                course.message(`Successfully filtered all quiz questions`);
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
            course.message(`Successfully completed match-question-answers`);
            stepCallback(null, course);
        }
    });
};
