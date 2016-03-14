Typefom
========================

[![RedConnect Approved](https://img.shields.io/badge/RedConnect-Approved-brightgreen.svg?style=flat)](https://www.redconnect.io/addons) [![Gitter](https://img.shields.io/gitter/room/badges/shields.svg)](https://gitter.im/redconnect-io/redconnect)

Install
-------

Run the following command in the root directory of your Node-RED install

    npm install node-red-contrib-typeform


Overview
-------

This addon help you to retrieve the data from typeform, is composed by 2 nodes :

- Typeform Answers
- Typeform List

## Typeform List

This node give you a list of the forms available on the account.

## Typeform Answers

This node require the id of a form.
You can pass in the input message the following optional parameters :
- form : id of the form ( if is specified here overwrite the one in the configuration ).
- since : the retrieved answers will be newer than this parameter.
- until
- offset
- limit

### Output

This node give the answers in the following structure :

```
	http_status
	stats
		responses
			showing
			total
			completed
	questions
		[
			id
			question
		]
	responses
		[
			id
			metadata
				data_land
				date_submit
			hidden
			[
				--- your hidden params ---
			]
			answers
			[
				--- your asnwers ( in raw format ) ---
			]
			getAnswerByQuestion()
		]
```

You can easily iterate over responses, for each response is available the function *getAnswerByQuestion*, you can obtain what the user reply to a question using

```
var choices = response.getAnswerByQuestion('How was your breakfast?');
```

The function outputs an array, this is in the case the question have multiple choices, or have an "other" choice ( in this case the first value of the array is an empty string and the second one is what the user write on "other" ).
