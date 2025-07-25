# Plan for Focus Fox Chrome Extension
focus-fox is a chrome extension that parses the current page and uses ai to help the user understand it better.
It will be a client only application with no backend server.
AI support will be provided by bring-your-own-key (BYOK) that has an openai compatible api (might add a default key later).

## Architecture
Effectively there will be 2 react applications:
1. **Chat Application**: This will be on the side panel and will be used to chat with the AI.
2. **Fox Button**: This will be a button that is injected into the page that lets the user open the chat application and support highlight quotes.

### Communication
The two applications will communicate using the [chrome messaging API](https://developer.chrome.com/docs/extensions/mv3/messaging/).
### Storage
The extension will use the [indexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) to store chat history.
For smaller stuffs like settings, the [chrome storage API](https://developer.chrome.com/docs/extensions/reference/storage) can be used instead.
### AI API
The extension will use the [openai sdk](https://www.npmjs.com/package/openai) to communicate with the AI API.
Responses will be streamed to the chat application.
### Highlighting
The extension will use the [chrome scripting API](https://developer.chrome.com/docs/extensions/reference/scripting) to inject the fox button into the page and to highlight quotes.
When the user highlights something and clicks the fox button, the selected text should be quoted in the chat application in the input box of the chat application (the chat application will be opened if it is not already open).
The user can add multiple quotes before sending the message.
This can be done by checking what the selected text is and then sending it to the chat application using the messaging API.
### Page Content Capture and Parsing
The extension will use the [chrome tabs API](https://developer.chrome.com/docs/extensions/reference/tabs) to capture the current page content.
The content will be parsed using [Readability.js](https://www.npmjs.com/package/@mozilla/readability) to extract the main content of the page, which is then converted to markdown using [turndown](https://www.npmjs.com/package/turndown).
