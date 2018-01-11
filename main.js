/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
const canvas = require('canvas-wrapper');
const asyncLib = require('async');

/* Variables */

//array of objects
// id -- > quiz id
// question --> quiz question text
// answer --> quiz answer
var quizId = [];

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
        var questionType = [
            'matching_question'
        ];

        asyncLib.eachLimit(quiz_items, 3, (item, eachCallback) => {
            canvas.getQuizQuestions(course.info.canvasOU, quiz_items, (getErr, questions) => {
                if (getErr) {
                    functionCallback(getErr);
                    return;
                } else {
                    questions.forEach(question => {
                        if (questionType.includes(question.question_type)) {
                            var obj = {
                                'id': question.id,
                                'question': question.question_text,
                                'answer': question.answer
                            };

                            quizId.push(obj);
                        }
                    });
                }
            });
        }, (err) => {
            if (err) {
                functionCallback(err);
            } else {
                course.success(`match-question-answers`, `Successfully filtered the quiz questions`);
            }
        });
    }

    var functions = [
        getQuizzes,
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
