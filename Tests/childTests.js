/*eslint-env node, es6*/

/* Dependencies */
const tap = require('tap');

function g1Tests(course, callback) {
    // Tap tests for Gauntlet 1 go here
    var questions = course.info.matchingQuestionsChanged;


    tap.equal(questions.length, 3)
    tap.equal(questions.filter(q => q.warning).length, 1);
    tap.equal(questions.filter(q => !q.warning).length, 2);
    callback(null, course);
}

module.exports = [
        {
            gauntlet: 1,
            tests: g1Tests
        }
];
