/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
const canvas = require('canvas-wrapper');
const asyncLib = require('async');

/* View available course object functions */
// https://github.com/byuitechops/d2l-to-canvas-conversion-tool/blob/master/documentation/classFunctions.md

module.exports = (course, stepCallback) => {
    //Create the module report so that we can access it later as needed.
    course.addModuleReport('match-question-answers');
    course.newInfo('matchingQuestionsChanged', []);

    /*********************************************
    * getQuizzes
    * Retrieves a list of quizzes in a course and
    * builds an object array based on each quiz
    **********************************************/
    function getQuizzes(course, functionCallback) {
        canvas.getQuizzes(course.info.canvasOU, (getErr, quiz_list) => {
            if (getErr) {
                functionCallback(getErr);
                return;
            } else {
                course.success(`match-question-answers`, `Successfully retrieved ${quiz_list.length} quizzes.`);
                functionCallback(null, course, quiz_list);
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
    function filterQuizQuestions(course, quiz_items, functionCallback) {

        //question types we want to work with
        var questionTypes = [
            'matching_question'
        ];

        //reason for 3 is that we don't overload the server
        asyncLib.eachLimit(quiz_items, 3, (item, eachCallback) => {
            var quizTitle = item.title;
            canvas.getQuizQuestions(course.info.canvasOU, item.id, (getErr, questions) => {
                if (getErr) {
                    functionCallback(getErr);
                    return;
                } else {
                    //go through every quiz question
                    asyncLib.each(questions, (q, innerEachCallBack) => {
                        //we do this to ensure that the arrays and string are cleared every time we execute this function
                        var a = [];         //for answers array object in QuizQuestion
                        var matches = [];   //array of objects for QuizQuestion
                        var answers = ``;   //string for all incorrect answers in the dropdown
                        var warn = false;   //for tap/testing

                        //we have found a question that is part of questionType array
                        //we switch the question and answer here
                        if (questionTypes.includes(q.question_type)) {
                            q.answers.forEach(index => {
                                //if there are more questions than answers, this is necessary
                                //so we don't accidentally create blank question(s)
                                if (index.right != null) {
                                    //multiple questions have the same answer
                                    if (q.answers.length < q.matches.length) {
                                        warn = true;

                                        //throw warning so humans can check out the quiz to ensure that there is no bugs
                                        course.throwWarning(`match-question-answers`,
                                             `You may want to look at quiz: ${quizTitle} at (matching) question ${q.position}. Multiple questions have the same answer.`);

                                        //for matching part of QuizQuestion object
                                        var newObj = {
                                            'match_id': index.match_id,         //id for correct match
                                            'text': index.left                  //part of dropdown for the correct answer
                                        };

                                        //for answers part of QuizQuestion object
                                        for (i in q.matches) {
                                            var obj = {
                                                'answer_text': index.text,                  //text of answer
                                                'id': index.id,                             //id of answer
                                                'answer_match_left': q.matches[i].text,     //the swapping happens here
                                                'answer_match_right': newObj.text           //the swapping ALSO happens here
                                            };

                                            a.push(obj);
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
                                        a.push(obj);                            //for answers object in QuizQuestion
                                    }
                                } else {
                                    answers += `${index.left}\n`;
                                }
                            });

                            //the question and answers has been switched. let's update the question on the quiz while we are at it
                            canvas.put(`/api/v1/courses/${course.info.canvasOU}/quizzes/${item.id}/questions/${q.id}`, {
                                'question': {
                                    'answers': a,
                                    'matching': matches,
                                    'matching_answer_incorrect_matches': answers
                                },
                            },
                            (putErr, results) => {
                                if (putErr) {
                                    innerEachCallBack(putErr);
                                    return;
                                } else {
                                    course.success(`match-question-answers`, `Successfully swapped answers for question ${q.id}`);

                                    //for testing (tap) purposes -- npm test
                                    course.info.matchingQuestionsChanged.push({
                                        'id': q.id,
                                        'warning': warn
                                    });
                                    innerEachCallBack(null, course);
                                }
                            });
                        }
                    });

                    eachCallback(null, course);
                }
            });
        }, (err) => {
            if (err) {
                functionCallback(err);
            } else {
                course.success(`match-question-answers`, `Successfully filtered all quiz questions`);
                functionCallback(null, course);
            }
        });
    }

    var functions = [
        //apply is necessary to include course object
        //More info: https://github.com/caolan/async/issues/14
        asyncLib.apply(getQuizzes, course),
        filterQuizQuestions
    ];

    /************************************************************
    *                         START HERE                        *
    ************************************************************/
    asyncLib.waterfall(functions, (waterfallErr, results) => {
        if (waterfallErr) {
            course.throwErr(`match-question-answers`, waterfallErr);
            stepCallback(null, course);
        } else {
            course.success(`match-question-answers`, `Successfully completed match-question-answers`);
            stepCallback(null, course);
        }
    });
};
