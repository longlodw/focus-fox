import { useEffect, useState } from "react";
import type { IMessage } from "../storage/message";
import { v7 } from "uuid";

export default function Chat() {
  const [messages, setMessages] = useState([] as IMessage[]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState({
    content: "",
    selectedTexts: [] as string[],
  });
  useEffect(() => {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === "selectedText") {
        port.onMessage.addListener((selectedText) => {
          setInputValue((prev) => {
            return {
              content: prev.content,
              selectedTexts: [...prev.selectedTexts, selectedText]
            };
          });
        });

        port.onDisconnect.addListener(() => {
          console.log("Port disconnected");
        });
      }
    });
  }, []);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {
          messages.map((message, index) => (
            <div key={index} className="mb-2">
              <div className="font-bold">{message.sender}</div>
              {message.selectedTexts && message.selectedTexts.length > 0 && (
                <div className="text-sm text-gray-500 mb-1">
                  Selected Texts: {message.selectedTexts.map(msg => `"${msg}"`).join(",\n")}
                </div>
              )}
              <div>{message.content}</div>
            </div>
          ))
        }
      </div>
      <div className="p-4 border-t">
        {/* Input field for new messages */}
        <input
          type="text"
          placeholder="Type your message..."
          className="w-full p-2 border rounded"
          value={inputValue.content}
          disabled={loading}
        />
        <button
          className="mt-2 bg-blue-500 text-white p-2 rounded"
          onClick={() => {
            if (inputValue.content.trim() === "") return;
            setLoading(true);
            const newMessage: IMessage = {
              id: v7(),
              sender: "user",
              content: inputValue.content,
              timestamp: Date.now(),
              selectedTexts: inputValue.selectedTexts,
            };
            setMessages((prev) => [...prev, newMessage]);
            setInputValue({ content: "", selectedTexts: [] });
          }}
          disabled={loading}
        />
      </div>
    </div>
  );
}
