# Match Questions Answers
### *Package Name*: match-questions-answers
### *Child Type*: Post-Import
### *Platform*: Online
### *Required*: Required

This child module is built to be used by the Brigham Young University - Idaho D2L to Canvas Conversion Tool. It utilizes the standard `module.exports => (course, stepCallback)` signature and uses the Conversion Tool's standard logging functions. You can view extended documentation [here](https://github.com/byuitechops/d2l-to-canvas-conversion-tool/tree/master/documentation).

## Purpose

During course import from Brightspace D2L to Canvas, the questions and answers for matching questions are swapped. This child module goes
through and swaps them back to the way it was. 

## How to Install

```
npm install match-questions-answers
```

## Run Requirements

None

## Options

None

## Outputs

None

## Process

Describe in steps how the module accomplishes its goals.

1. Get all of the quizzes in the course through a Canvas API call.
2. Go through each quiz
    - The child module ignores all non-matching quiz questions.
    - Ensure that the correct answer is still stored in the question before initiating API call.
    - If it finds a matching quiz questions, it collects all of the required data and then makes an API call to Canvas to swap them
    by setting the question to be the answers and vice versa.
3. If there is a quiz question where multiple questions have the same answers, the child module will throw a warning to make sure that the 
person running the tool will check the question to ensure that it is accurate.

## Log Categories

List the categories used in logging data in your module.

- ID of the question that swapped, name of the question that was swapped - Title: Quiz Question Swapping

## Requirements

1. Ensure that the questions and answers for the matching question on Canvas matches the Brightspace D2L version. 