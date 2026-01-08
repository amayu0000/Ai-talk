#!/usr/bin/env python3
"""
Natural AI Chat API - 元のnatural_ai_chat.pyベース
"""

import asyncio
import os
import sys
import json
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from google import genai

class NaturalAIChatAPI:
    """API用チャット（元のロジックをそのまま使用）"""
    
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.anthropic_client = AsyncAnthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        
        # Gemini 新API
        self.genai_client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'))
        
        self.conversation_history: List[Dict] = []
        
    async def start_chat(self, topic: str, turns: int = 10, conversation_id: str = None, is_continuation: bool = False):
        """会話を開始（SSEで出力）"""
        self.send_event('start', {'topic': topic, 'turns': turns})
        
        # 既存の会話を読み込み
        if conversation_id:
            await self.load_conversation(conversation_id)
        
        # 続きモードの場合、最初のターンをスキップして中盤から開始
        if is_continuation and len(self.conversation_history) > 0:
            start_turn = len(self.conversation_history) + 1
            
            # 前回の最後のAIを確認
            last_ai = self.conversation_history[-1]['ai']
            ai_order = ["GPT-4", "Claude", "Gemini"]
            
            # 前回の最後のAIの次から開始
            if last_ai in ai_order:
                last_index = ai_order.index(last_ai)
                ai_order = ai_order[last_index+1:] + ai_order[:last_index+1]
            
            # 追加の会話ターン
            full_order = ai_order * ((turns - 1) // 3 + 1)
            
            for i, ai_name in enumerate(full_order[:turns-1], start=start_turn):
                await asyncio.sleep(1)  # 1秒待機（レート制限対策）
                await self._add_turn(ai_name, topic, turn_num=i, total_turns=start_turn + turns - 1)
            
            # 最後のターン: 結論
            await asyncio.sleep(1)
            final_ai = full_order[turns-2] if turns > 1 else ai_order[0]
            await self._add_turn(final_ai, topic, turn_num=start_turn + turns, total_turns=start_turn + turns, is_final=True)
        else:
            # 通常の新規会話
            # 最初のメッセージ
            await self._add_turn("GPT-4", topic, turn_num=1, total_turns=turns, is_first=True)
            
            # ターン制で会話（最後は必ず結論）
            ai_order = ["Claude", "Gemini", "GPT-4"] * ((turns - 1) // 3 + 1)
            
            for i, ai_name in enumerate(ai_order[:turns-2], start=2):
                await asyncio.sleep(1)  # 1秒待機（レート制限対策）
                await self._add_turn(ai_name, topic, turn_num=i, total_turns=turns)
            
            # 最後のターン: 結論を出す
            await asyncio.sleep(1)
            final_ai = ai_order[turns-2] if turns > 2 else "GPT-4"
            await self._add_turn(final_ai, topic, turn_num=turns, total_turns=turns, is_final=True)
        
        # 保存
        conv_id = conversation_id or self.save_conversation(topic)
        
        self.send_event('complete', {
            'conversation_id': conv_id,
            'total_messages': len(self.conversation_history)
        })
    
    async def _add_turn(self, ai_name: str, topic: str, turn_num: int, total_turns: int, 
                       is_first: bool = False, is_final: bool = False):
        """1ターン分の発言"""
        
        # 進捗状況を計算
        progress = turn_num / total_turns
        
        if ai_name == "Gemini":
            response = await self._gemini_turn(topic, turn_num, total_turns, is_first, is_final, progress)
        else:
            response = await self._gpt_claude_turn(ai_name, topic, turn_num, total_turns, is_first, is_final, progress)
        
        message = {
            'ai': ai_name,
            'message': response,
            'turn': turn_num,
            'timestamp': datetime.now().isoformat()
        }
        
        self.conversation_history.append(message)
        self.send_event('message', message)
    
    def send_event(self, event_type: str, data: dict):
        """SSEイベント送信"""
        output = {
            'type': event_type,
            'data': data
        }
        print(json.dumps(output), flush=True)
        sys.stdout.flush()
    
    async def _gemini_turn(self, topic: str, turn_num: int, total_turns: int, 
                          is_first: bool, is_final: bool, progress: float) -> str:
        """Geminiのターン"""
        recent = self._format_history()
        
        prompt = self._build_prompt(
            topic=topic,
            recent_chat=recent,
            turn_num=turn_num,
            total_turns=total_turns,
            is_first=is_first,
            is_final=is_final,
            progress=progress
        )
        
        try:
            response = await asyncio.to_thread(
                self.genai_client.models.generate_content,
                model='gemini-2.0-flash-exp',
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            return f"（エラーが発生しました: {str(e)[:50]}）"
    
    async def _gpt_claude_turn(self, ai_name: str, topic: str, turn_num: int, total_turns: int,
                               is_first: bool, is_final: bool, progress: float) -> str:
        """GPT-4/Claudeのターン"""
        recent = self._format_history()
        
        prompt = self._build_prompt(
            topic=topic,
            recent_chat=recent,
            turn_num=turn_num,
            total_turns=total_turns,
            is_first=is_first,
            is_final=is_final,
            progress=progress
        )
        
        # 最終ターンはトークン数を増やす
        max_tokens = 1000 if is_final else 500
        
        if ai_name == "GPT-4":
            return await self._call_gpt(prompt, max_tokens)
        else:
            return await self._call_claude(prompt, max_tokens)
    
    def _build_prompt(self, topic: str, recent_chat: str, turn_num: int, total_turns: int,
                     is_first: bool, is_final: bool, progress: float) -> str:
        """状況に応じたプロンプトを構築（元のロジック）"""
        
        if is_first:
            return f"""あなたは友達3人で会話しています。

お題: {topic}

【重要なルール】
このお題について「直接答える」会話をしてください。
- 「明日の天気は?」→ 天気予報を調べて答える
- 「PCパーツのおすすめは?」→ 具体的なパーツを提案する
- 関連する別の話題（ピクニック、買い物など）に発展させないでください

全{total_turns}ターンの会話を通して、このお題に対する明確な結論を出す予定です。

最初のターンとして:
- お題に直接答える方向で話す
- カジュアルに話題を振る
- 1-3文で簡潔に

※「A:」「B:」などの記号は不要"""
        
        elif is_final:
            return f"""あなたは友達3人で会話しています。

お題: {topic}

これまでの会話:
{recent_chat}

これが最終ターン（{turn_num}/{total_turns}）です。
お題「{topic}」に対する明確な結論を出してください。

お題の性質に応じて:
- 質問なら → 具体的な答え
- リスト依頼なら → 見やすいリストで（商品名・型番・価格を明記）
- 相談なら → 実行可能な提案
- 議論なら → まとめた見解

例:
「明日の天気は?」→ 「明日は午前曇り、午後雨。気温22度」
「PCパーツは?」→ 【推奨構成】GPU: RTX 4070...

自然に、でも明確に結論を述べてください。"""
        
        else:
            # 中盤のターン: 進捗に応じて会話を深める
            stage = ""
            guidance = ""
            if progress < 0.3:
                stage = "議論を発散させる段階"
                guidance = "様々な選択肢やアイデアを出す"
            elif progress < 0.7:
                stage = "具体化・深掘りする段階"
                guidance = "具体的な商品名・型番・価格を挙げる"
            else:
                stage = "結論に向かって収束させる段階"
                guidance = "絞り込んで最適解を見つける"
            
            return f"""あなたは友達3人で会話しています。

お題: {topic}

これまでの会話:
{recent_chat}

現在{turn_num}/{total_turns}ターン目（{stage}）です。

【重要なルール】
お題「{topic}」に直接答える会話を続けてください。
前の人が話を逸らした場合は、お題に戻してください。

前の人の発言を受けて、自然に会話を続けてください:
- 前の発言に反応する
- {guidance}
- お題の結論に向かって進める
- 1-3文で簡潔に

※「A:」「B:」などの記号は不要"""
    
    def _format_history(self, n: int = 5) -> str:
        """最近の会話履歴"""
        recent = self.conversation_history[-n:]
        return "\n".join([f"{m['ai']}: {m['message']}" for m in recent])
    
    async def _call_gpt(self, prompt: str, max_tokens: int) -> str:
        try:
            r = await self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=max_tokens
            )
            return r.choices[0].message.content.strip()
        except Exception as e:
            return f"[Error: {str(e)[:30]}]"
    
    async def _call_claude(self, prompt: str, max_tokens: int) -> str:
        try:
            r = await self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}]
            )
            return r.content[0].text.strip()
        except Exception as e:
            return f"[Error: {str(e)[:30]}]"
    
    def save_conversation(self, topic: str) -> str:
        """会話を保存"""
        chat_dir = os.path.join(os.getcwd(), 'chat')
        os.makedirs(chat_dir, exist_ok=True)
        
        conv_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"chat_{conv_id}.json"
        filepath = os.path.join(chat_dir, filename)
        
        data = {
            'id': conv_id,
            'topic': topic,
            'messages': self.conversation_history,
            'created_at': datetime.now().isoformat()
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return conv_id
    
    async def load_conversation(self, conversation_id: str):
        """会話を読み込み"""
        filepath = os.path.join(os.getcwd(), 'chat', f'chat_{conversation_id}.json')
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.conversation_history = data['messages']
        except Exception:
            pass


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({'type': 'error', 'data': {'message': 'Topic required'}}))
        return
    
    topic = sys.argv[1]
    turns = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    conversation_id = sys.argv[3] if len(sys.argv) > 3 else None
    is_continuation = sys.argv[4] == 'true' if len(sys.argv) > 4 else False
    
    chat = NaturalAIChatAPI()
    await chat.start_chat(topic, turns, conversation_id, is_continuation)


if __name__ == "__main__":
    asyncio.run(main())