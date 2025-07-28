import OpenAI from "openai";
import type { IMessage } from "../storage/message";
import type { IModel } from "../storage/model";

export class AI {
  private model: IModel;
  private client: OpenAI;

  constructor(model: IModel) {
    this.model = model;
    this.client = new OpenAI({
      apiKey: model.apikey,
      baseURL: model.baseUrl,
    });
  }

  async createChatCompletion(messages: IMessage[]): Promise<AsyncIterable<string>> {
    const response = await this.client.chat.completions.create({
      model: this.model.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: true,
    });
    return {
      async *[Symbol.asyncIterator]() {
        for await (const part of response) {
          if (part.choices[0].delta?.content) {
            yield part.choices[0].delta.content;
          }
        }
      },
    };
  }
}
