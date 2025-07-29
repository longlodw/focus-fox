import { useEffect, useState } from "react";
import { createMessagesStorage, type IMessage } from "../storage/message";
import { createModelsStorage } from "../storage/model";
import { v7 } from "uuid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AI } from "../ai/ai";
import { useDomContent } from "../hooks/useDomContent";

export default function Chat({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState({
    content: "",
    selectedTexts: [] as string[],
  });
  const getDomContent = useDomContent();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const { isPending, isFetching, isError, data, error } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const promises = await Promise.all([
        createMessagesStorage(roomId).then(messagesStorage => messagesStorage.load()),
        createModelsStorage().then(modelsStorage => modelsStorage.load()),
      ]);
      const messages = promises[0].filter((message: IMessage) => message.role !== "system");
      const models = promises[1];
      return {
        messages,
        models,
      };
    },
  });
  const { messages, models } = data || { messages: [], models: [] };
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (newMessage: IMessage) => {
      if (!selectedModel) {
        throw new Error("No model selected");
      }
      const messagesStorage = await createMessagesStorage(roomId);
      const domConent = await getDomContent();
      if (domConent && domConent.changed) {
        const newSystemMessage: IMessage = {
          roomId: roomId,
          id: v7(),
          role: "system",
          content: `You are an AI assistant. The user has provided the following content from the current page:\n\n${domConent.dom}`,
          timestamp: Date.now(),
        };
        await messagesStorage.store([newSystemMessage]);
      }
      await messagesStorage.store([newMessage]);
      const recentMessages = await messagesStorage.load(undefined, 32);
      const ai = new AI(models.find((model) => model.id == selectedModel)!);
      return await ai.createChatCompletion(recentMessages);
    },
    onMutate: () => {
      setLoading(true);
      setCurrentResponse("");
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
    },
    onSettled: async (data, error) => {
      if (error) {
        console.error("Error during AI response:", error);
        setLoading(false);
        return;
      }
      if (!data) {
        console.error("No data received from AI");
        setLoading(false);
        return;
      }
      for await (const chunk of data) {
        setCurrentResponse((prev) => prev + chunk);
      }
      const newMessage: IMessage = {
        roomId: roomId,
        id: v7(),
        role: "assistant",
        content: currentResponse,
        timestamp: Date.now(),
      };
      const messagesStorage = await createMessagesStorage(roomId);
      await messagesStorage.store([newMessage]);
      setCurrentResponse("");
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      setLoading(false);
    }
  });
  const [currentResponse, setCurrentResponse] = useState<string>("");
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
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Chat Room: {roomId}</h1>
        {
          isPending || isFetching || isError || (<select
            className="mt-2 p-2 border rounded"
            value={selectedModel || ""}
            onChange={(e) => setSelectedModel(e.target.id)}
            disabled={loading || isPending || isFetching || isError}
          >
            <option value="">Select Model</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.model}
              </option>
            ))}
          </select>)
        }
      </div>
      {
        // spinner for loading state
        isPending || isFetching ? (
          <div className="flex items-center justify-center h-full">
            <div className="loader"></div>
          </div>
        ) : isError ? (
          <div className="text-red-500 p-4">
            Error loading messages: {error.message}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {
              messages.map((message, index) => (
                <div key={index} className="mb-2">
                  <div className="font-bold">{message.role}</div>
                  {message.selectedTexts && message.selectedTexts.length > 0 && (
                    <div className="text-sm text-gray-500 mb-1">
                      Selected Texts: {message.selectedTexts.map(msg => `"${msg}"`).join(",\n")}
                    </div>
                  )}
                  <div>{message.content}</div>
                </div>
              ))
            }
            {
              currentResponse && loading && (
                <div className="text-blue-500 mt-2">
                  {currentResponse}
                </div>
              )
            }
          </div>
        )
      }
      <div className="p-4 border-t">
        {/* Input field for new messages */}
        <input
          type="text"
          placeholder="Type your message..."
          className="w-full p-2 border rounded"
          value={inputValue.content}
          disabled={loading || isPending || isFetching || isError}
        />
        <button
          className="mt-2 bg-blue-500 text-white p-2 rounded"
          onClick={async () => {
            if (inputValue.content.trim() === "") return;
            const newMessage: IMessage = {
              roomId: roomId,
              id: v7(),
              role: "user",
              content: inputValue.content,
              timestamp: Date.now(),
              selectedTexts: inputValue.selectedTexts,
            };
            setInputValue({ content: "", selectedTexts: [] });
            await mutation.mutateAsync(newMessage);
          }}
          disabled={loading || isPending || isFetching || isError || !selectedModel}
        />
      </div>
    </div>
  );
}
