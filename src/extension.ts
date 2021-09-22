/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import axios from 'axios';
import * as phpparser from 'php-parser';

export function activate(context: vscode.ExtensionContext) {

	// response = await fetch('https://raw.githubusercontent.com/wikimedia/mediawiki/master/includes/DefaultSettings.php');
	// data = await response.body;
	// console.log(data);	
	//Create output channel
	let orange = vscode.window.createOutputChannel("Orange");

	// initialize a new parser instance
	var parser = new phpparser.Engine(

		{
			parser: {
			  debug: false, 
			  locations: false,
			  extractDoc: true,
			  suppressErrors: false
			},
			ast: {
			  withPositions: true,
			  withSource: true
			},
			lexer: {
			  all_tokens: false,
			  comment_tokens: false,
			  mode_eval: false,
			  asp_tags: false,
			  short_tags: false
			}
		}

	);

	//Write to output.
	axios.get(
		'https://raw.githubusercontent.com/wikimedia/mediawiki/master/includes/DefaultSettings.php',
		).then( (resp) => {
			//console.log(resp.data);
			//orange.appendLine(resp.data);
			const defaultSettings = parser.parseCode(resp.data, 'DefaultSettings.php');
			orange.appendLine(defaultSettings.children.length.toString());
			let variables: string[] = [];
			let comments: string[] = [];
			let values : string[] = [];
			let types : string[] = [];

			for(var i = 0 ; i < defaultSettings.children.length; i++ ) {
				const element:phpparser.Node = defaultSettings.children[i];
				const json = JSON.parse(JSON.stringify(element));
				if( ( json['kind'] === 'expressionstatement' ) ) {
					if(json['expression']['kind'] === 'assign') {
						let variableName = json['expression']['left']['name']
						if( !variableName ){
							let what = json['expression']['left']['what'];
							while( !what['name'] && what['what']) {
								what = what['what'];
							}

							if( !what['name'] ){
								orange.appendLine("missing variable name: " + JSON.stringify(json['expression']['left']));
								continue;
							}

							variableName = what['name'];
						}

						if(  variables.includes(variableName) ) {
							continue;
						}
						
						variables.push(variableName);
						
						
						let value = "unknown";

						const kind = json['expression']['right']['kind'];
						const rawValue = json['expression']['right']['raw'];

						if( kind === 'new' ) {
							value = 'new ' + json['expression']['right']['what']['name'];
						} else if (kind === 'name') {
							value = json['expression']['right']['name']
						} else if (rawValue) {
							value = rawValue;
						}

						if( kind ) {
							types.push(kind);
						} else {
							types.push('unkown')
						}

												
						let leadingComment = "";

						if(json['leadingComments']) {
							for(var i = 0; i < json['leadingComments'].length; i++){
								try{
									let comment: String = json['leadingComments'][i]['value'];

									if(!comment){
										continue;
									}
		
									if( !comment.includes("@endcond") && !comment.includes("@phan") ) {
										leadingComment += comment;
									}	
								}catch(e){
									orange.appendLine("failed parsing comment: " + JSON.stringify(json));
								}
					
							}
						}

						comments.push(leadingComment);

						values.push(value);

						
					}

				}
	

			};

			orange.appendLine("added " + variables.length + " variables.");

			const statements : vscode.CompletionItem[] = [];
		
					
					for(var i = 0 ; i < variables.length; i++ ){
						const completionSuggestion = "$" + variables[i];
						const insertText = comments[i] + "\n\\$" + variables[i] + " = " + values[i];

						//orange.appendLine('adding suggestion: ' + completionSuggestion);

						const snippetCompletion = new vscode.CompletionItem(completionSuggestion);
						snippetCompletion.insertText = new vscode.SnippetString(insertText);
						snippetCompletion.documentation = new vscode.MarkdownString("Hello jesus");
						snippetCompletion.detail = types[i];
						statements.push(snippetCompletion);
					};

			const provider1 = vscode.languages.registerCompletionItemProvider('plaintext', {

				provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
		
					
		

				
					// // a completion item that can be accepted by a commit character,
					// // the `commitCharacters`-property is set which means that the completion will
					// // be inserted and then the character will be typed.
					// const commitCharacterCompletion = new vscode.CompletionItem('$');
					// commitCharacterCompletion.commitCharacters = ['wg'];
					// commitCharacterCompletion.documentation = new vscode.MarkdownString('Press `.` to get `console.`');
		
					// // a completion item that retriggers IntelliSense when being accepted,
					// // the `command`-property is set which the editor will execute after 
					// // completion has been inserted. Also, the `insertText` is set so that 
					// // a space is inserted after `new`
					// const commandCompletion = new vscode.CompletionItem('new');
					// commandCompletion.kind = vscode.CompletionItemKind.Keyword;
					// commandCompletion.insertText = 'new ';
					// commandCompletion.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };
		
					// return all completion items as array
					return statements;
				}
			});
		/*
			const provider2 = vscode.languages.registerCompletionItemProvider(
				'plaintext',
				{
					provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
		
						// get all text until the `position` and check if it reads `console.`
						// and if so then complete if `log`, `warn`, and `error`
						const linePrefix = document.lineAt(position).text.substr(0, position.character);
						if (!linePrefix.endsWith('$wg')) {
							return undefined;
						}
		
						return [
							new vscode.CompletionItem('Server', vscode.CompletionItemKind.Method),
							new vscode.CompletionItem('DebugLog', vscode.CompletionItemKind.Method),
							new vscode.CompletionItem('Cache', vscode.CompletionItemKind.Method),
						];
					}
				},
				'.' // triggered whenever a '.' is being typed
			);
			*/
		
			context.subscriptions.push(provider1);
		});

	
}
