/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
const canvas = require('canvas-wrapper');
const asyncLib = require('async');

/* Variables */

/* View available course object functions */
// https://github.com/byuitechops/d2l-to-canvas-conversion-tool/blob/master/documentation/classFunctions.md

module.exports = (course, stepCallback) => {
    //Create the module report so that we can access it later as needed.
    course.addModuleReport('match-question-answers');

    //Get list of all quizzes -- canvas.getQuizzes
    //iterate through quizzes and get all questions -- canvas.getQuizQuestions && identify all matching questions -- array of IDs
    //iterate through all matching questions and swap questions and answers

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

    function filterQuizQuestions(course, quiz_items, functionCallback) {
        var questionTypes = [
            'matching_question'
        ];

        asyncLib.eachLimit(quiz_items, 1, (item, eachCallback) => {
            canvas.getQuizQuestions(course.info.canvasOU, item.id, (getErr, questions) => {
                if (getErr) {
                    functionCallback(getErr);
                    return;
                } else {
                    var a = [];
                    asyncLib.each(questions, (q, innerEachCallBack) => {
                        if (questionTypes.includes(q.question_type)) {
                            //console.log(`Q: ${JSON.stringify(q)}`);
                            q.answers.forEach(index => {
                                var obj = {
                                    'answer_text':index.text,
                                    'id': index.id,
                                    'answer_match_left': index.right,
                                    'matching_answer_right': index.left
                                }

                                a.push(obj);
                            });

                            canvas.put(`/api/v1/courses/${course.info.canvasOU}/quizzes/${item.id}/questions/${q.id}`, {
                                'question': {
                                    'answers': a
                                },
                            },
                            (putErr, results) => {
                                if (putErr) {
                                    innerEachCallBack(putErr);
                                    return;
                                } else {
                                    a = a.splice(0, a.length);
                                    course.success(`match-question-answers`, `Successfully swapped answers for question ${q.id}`);
                                    innerEachCallBack(null, course);
                                }
                            });
                        }
                    });

                    //course.success(`match-question-answers`, `Successfully swapped all matching questions`);
                    eachCallback(null, course);
                }
            });
        }, (err) => {
            if (err) {
                functionCallback(err);
            } else {
                course.success(`match-question-answers`, `Successfully filtered the quiz questions`);
                functionCallback(null, course);
            }
        });
    }

    var functions = [
        //https://github.com/caolan/async/issues/14
        asyncLib.apply(getQuizzes, course),
        filterQuizQuestions
    ];

    asyncLib.waterfall(functions, (waterfallErr, results) => {
        if (waterfallErr) {
            course.throwErr(`match-question-answers`, waterfallErr);
            stepCallback(null, course);
        } else {
            course.success(`match-questions-answers`, `Successfully completed match-questions-answers`);
            stepCallback(null, course);
        }
    });
};
