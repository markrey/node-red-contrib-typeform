/**
 * Copyright 2015 mcarboni@redant.com
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/



 module.exports = function(RED) {
    'use strict';
    var querystring=require('querystring');
    var request=require('request');

    RED.httpAdmin.put('/typeformAPI/:id',function (req,res) {
        var body = '';
        req.on('data', function(chunk) {
            body+=chunk;
        });
        req.on('end', function(){
            console.log(body);
        });
    });

    RED.httpAdmin.get('/typeformAPI/:id',function(req,res) {
        var credentials = RED.nodes.getCredentials(req.params.id);
        if (credentials) {
            res.send(JSON.stringify({hasPassword:(credentials.key&&credentials.key!='')}));
        } else {
            res.send(JSON.stringify({}));
        }
    });

    RED.httpAdmin.delete('/typeformAPI/:id',function(req,res) {
        RED.nodes.deleteCredentials(req.params.id);
        res.send(200);
    });

    RED.httpAdmin.post('/typeformAPI/:id',function(req,res) {
        var body = '';
        req.on('data', function(chunk) {
            body+=chunk;
        });
        req.on('end', function(){
            var newCreds = querystring.parse(body);
            var credentials = RED.nodes.getCredentials(req.params.id)||{};
            credentials.key = newCreds.key||credentials.key;
            RED.nodes.addCredentials(req.params.id,credentials);
            res.send(200);
        });
    });

    /*
        Typeform API Node
        Store the typeform configuration
    */

    function TypeformAPINode(n) {
        RED.nodes.createNode(this,n);

        this.key = this.credentials
                    ? this.credentials.key
                    : '';
    }

    RED.nodes.registerType('typeformAPI',TypeformAPINode,{
        credentials: {
            key: {type: 'password'}
        }
    });

    /*
        Get responses of a form
    */

    var multipleChoiceRegex = /^(list_.*_choice)_[\d]+$/;

    function _isMultipleChoice(id) {
        return id.match(multipleChoiceRegex);
    }

    function _convertToNormalChars(str) {
        var special_chars = {
                '\xA0' : '\x20'
            };

        for (var val in special_chars) {
            str = str.split(val).join(special_chars[val]);
        }

        return str;
    }

    function _getAnswerByQuestion(answers) {
        return function (question,caseSensitive) {
            console.log('Searching ',question);
            var filter_answers;
            var q = _convertToNormalChars(question).trim();
            if ( caseSensitive ) {
                filter_answers = answers.filter(function (a) {
                    return a[1] === q;
                });
            } else {
                q = q.toLowerCase();
                filter_answers = answers.filter(function (a) {
                    // if ( question === 'Overall, I was satisfied with the drinks') {
                    //     console.log(a[1].toLowerCase() === q,a[1].toLowerCase(),q);
                    // }
                    return a[1].toLowerCase() === q;
                });
            }
            console.log('Found',filter_answers.length,'results');
            return filter_answers.map(function (a) {
                return a[2];
            });
        };
    }

    function _mapResponses(questions,form) {
        return function (response) {
            var answers = [],
                groupId;
            for ( var id in response.answers ) {
                if ( response.answers.hasOwnProperty(id) && questions.hasOwnProperty(id) ) {
                    if ( (groupId = _isMultipleChoice(id)) ) {
                        //Search if this question already exists
                        var foundAnswer = answers.filter(function (ans) {
                            return ans[0] === groupId;
                        });
                        var answerValue = response.answers[id] === ''
                                            ? []
                                            : [response.answers[id]];
                        if ( foundAnswer.length ) {
                            foundAnswer[0][2] = foundAnswer[0][2].concat(answerValue);
                        } else {
                            answers.push([
                                groupId
                                ,questions[id].question
                                ,answerValue
                                ,questions[id].group || false
                            ]);
                        }
                    } else {
                        answers.push([
                            id
                            ,questions[id].question
                            ,response.answers[id]
                            ,questions[id].group || false
                        ]);
                    }
                }
            }
            response.getAnswerByQuestion = _getAnswerByQuestion(answers);
            response.answers = answers;
            response.uid = form+id;
            return response;
        };
    }

    function _mapQuestions(questions) {
        var result = {};
        for ( var i=0,l=questions.length; i<l; i++ ) {
            questions[i].question = _convertToNormalChars(questions[i].question).trim();
            result[questions[i].id] = questions[i];
            delete result[questions[i].id].id;
        }
        return result;
    }

    function TypeformAnswersNode(n) {
        var node = this;

        RED.nodes.createNode(this,n);

        this.key = RED.nodes.getNode(n.key).key;
        this.form = n.form;

        node.on('input',function (msg) {
            var form = node.form
                        ? node.form
                        : msg.payload;
            var query = {
                    key         : node.key
                    ,completed   : true
                };
            if ( msg.since ) {
                query.since = msg.since instanceof Date
                                ? Math.floor(msg.since.getTime()/1000)
                                : typeof msg.since === 'number'
                                    ? msg.since
                                    : Math.floor((new Date(msg.since)).getTime()/1000);
            }
            if ( msg.until ) {
                query.until = msg.until instanceof Date
                                ? Math.floor(msg.until.getTime()/1000)
                                : parseInt(msg.until);
            }
            if ( msg.offset ) {
                query.offset = msg.offset;
            }
            if ( msg.limit ) {
                query.limit = msg.limit;
            }
            if ( msg.orderBy ) {
                query.order_by = msg.orderBy.map(function (order) {
                    return [].concat(order).join(',');
                });
            }
            request({
                uri     : 'https://api.typeform.com/v0/form/'+form,
                qs      : query,
                json    : true
            }, function (err, response, body) {
                if ( err ) {
                    return node.error(err);
                }
                if ( body.status && body.status !== 200 ) {
                    console.log(query);
                    return node.error(body);
                }
                //Iterate over body
                msg.payload = ( body.responses || [] ).map(_mapResponses(_mapQuestions(body.questions),form));
                node.send(msg);
            });
        });

    }

    RED.nodes.registerType('Typeform Answers',TypeformAnswersNode);

    /*
        Typeform List
        Obtain a list of all the forms available on typeform
    */

    function TypeformListNode(n) {
        var node = this;

        RED.nodes.createNode(this,n);
        this.key = RED.nodes.getNode(n.key).key;

        node.on('input',function (msg) {
            request({
                uri     : 'https://api.typeform.com/v0/forms',
                qs      : {
                    key     : node.key
                },
                json    : true
            }, function (err, response, body) {
                if ( err ) {
                    return node.error(err);
                }
                msg.payload = body;
                node.send(msg);
            });
        });

    }

    RED.nodes.registerType('Typeform List',TypeformListNode);
};
