
import * as vscode from 'vscode';
import axios from 'axios';
import * as phpparser from 'php-parser';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {


	const log = vscode.window.createOutputChannel("LocalSettings");
	const config = vscode.workspace.getConfiguration('localsettings');

	const configBranch = config.get<string>("branch");
	const configAddVariableComments = config.get<string>("addVariableComments");

	log.appendLine("Branch: " + configBranch);
	log.appendLine("Add comments: " + configAddVariableComments);

	// initialize a new parser instance
	const parser = new phpparser.Engine(

		{
			parser: {
				debug: false,
				locations: false,
				extractDoc: true,
				suppressErrors: false
			},
			ast: {
				withPositions: false,
				withSource: false
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

	const dir: string = context.storagePath ?? '/tmp/vscode-localSettings/';

	if (!fs.existsSync(dir) ){
    	fs.mkdirSync(dir);
	}
	
	const filename = dir + '/' + 'DefaultSettings.' + configBranch + '.php';
	log.appendLine("Reading cache " + filename );

	fs.readFile(filename, function (err, data) {
		if (err) {
			log.appendLine("No cache to read");
			return readFromSource();
		}
		log.appendLine("Using cache");
		return readData('' + data);
	});

	const readData = function (data: string) {

		fs.writeFile(filename, data, function (err) {
			if (err) {
				return log.appendLine("failed to write file!");
			}
			log.appendLine("Cache file created " + filename);
		});

		const defaultSettings = parser.parseCode(data, 'DefaultSettings.php');
		log.appendLine(defaultSettings.children.length.toString());
		const variables: string[] = [];
		const comments: string[] = [];
		const values: string[] = [];
		const types: string[] = [];

		for (let i = 0; i < defaultSettings.children.length; i++) {
			const element: phpparser.Node = defaultSettings.children[i];
			const json = JSON.parse(JSON.stringify(element));
			if ((json['kind'] === 'expressionstatement')) {
				if (json['expression']['kind'] === 'assign') {
					let variableName = json['expression']['left']['name'];
					if (!variableName) {
						let what = json['expression']['left']['what'];
						while (!what['name'] && what['what']) {
							what = what['what'];
						}

						if (!what['name']) {
							log.appendLine("missing variable name: " + JSON.stringify(json['expression']['left']));
							continue;
						}

						variableName = what['name'];
					}

					if (variables.includes(variableName)) {
						continue;
					}

					variables.push(variableName);
					let value = "unknown";

					const kind = json['expression']['right']['kind'];
					const rawValue = json['expression']['right']['raw'];

					if (kind === 'new') {
						value = 'new ' + json['expression']['right']['what']['name'];
					} else if (kind === 'name') {
						value = json['expression']['right']['name'];
					} else if (rawValue) {
						value = rawValue;
					}

					if (kind) {
						types.push(kind);
					} else {
						types.push('unkown');
					}

					let leadingComment = "";

					if (json['leadingComments']) {
						for (let i = 0; i < json['leadingComments'].length; i++) {
							try {
								const comment: string = json['leadingComments'][i]['value'];

								if (!comment) {
									continue;
								}

								if (!comment.includes("@endcond") && !comment.includes("@phan")) {
									leadingComment += comment;
								}
							} catch (e) {
								log.appendLine("failed parsing comment: " + JSON.stringify(json));
							}
						}
					}
					comments.push(leadingComment);
					values.push(value);
				}
			}
		}

		log.appendLine("added " + variables.length + " variables.");

		const statements: vscode.CompletionItem[] = [];

		for (let i = 0; i < variables.length; i++) {
			let commentFinal = '';
			const completionSuggestion = "$" + variables[i];
			
			if( configAddVariableComments ) {
				// eslint-disable-next-line no-useless-escape
				const manualLink = "// https://www.mediawiki.org/wiki/Manual:\\\$" + variables[i];
				commentFinal = comments[i] + "\n" + manualLink;
			}
			
			// eslint-disable-next-line no-useless-escape
			const insertText = commentFinal+ "\n\\\$" + variables[i] + " = " + values[i] + ';';

			const snippetCompletion = new vscode.CompletionItem(completionSuggestion);
			snippetCompletion.insertText = new vscode.SnippetString(insertText);
			snippetCompletion.documentation = new vscode.MarkdownString(comments[i]);
			snippetCompletion.detail = types[i];

			statements.push(snippetCompletion);
		}

		const provider1 = vscode.languages.registerCompletionItemProvider('php', {
			provideCompletionItems(
				document: vscode.TextDocument,
				position: vscode.Position,
				token: vscode.CancellationToken,
				context: vscode.CompletionContext
			) {
				return statements;
			}
		});
		context.subscriptions.push(provider1);

	};

	// wikibase
	// https://github.com/wikimedia/Wikibase/blob/master/repo/config/Wikibase.default.php
	const readFromSource = function () {
		//Write to output.
		axios.get(
			'https://raw.githubusercontent.com/wikimedia/mediawiki/' + configBranch + '/includes/DefaultSettings.php',
		).then((resp) => {
			readData(resp.data);
		});
	};
}
