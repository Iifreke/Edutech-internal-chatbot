'use client';

export default function MessageBubble({ message }) {
  const { role } = message;
  const isUser = role === 'user';

  // AI SDK v6 uses parts array; fallback to content string
  const content = message.parts
    ? message.parts.map(p => p.type === 'text' ? p.text : '').join('')
    : (message.content || '');

  // Simple markdown-like formatting for assistant messages
  const formatContent = (text) => {
    if (isUser) return text;

    return text
      .split('\n')
      .map((line) => {
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Inline code
        line = line.replace(/`(.*?)`/g, '<code>$1</code>');
        // Bullet points
        if (line.match(/^[-•]\s/)) {
          return `<li>${line.replace(/^[-•]\s/, '')}</li>`;
        }
        // Numbered lists
        if (line.match(/^\d+\.\s/)) {
          return `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
        }
        // Headers
        if (line.match(/^###\s/)) {
          return `<strong>${line.replace(/^###\s/, '')}</strong>`;
        }
        if (line.match(/^##\s/)) {
          return `<strong>${line.replace(/^##\s/, '')}</strong>`;
        }
        if (line === '') return '<br/>';
        return `<p>${line}</p>`;
      })
      .join('');
  };

  return (
    <div className={`message-row ${role}`}>
      <div className={`message-avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
        {isUser ? '👤' : 'E'}
      </div>
      <div className={`message-content ${isUser ? 'user-msg' : 'assistant-msg'}`}>
        {isUser ? (
          content
        ) : (
          <div dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
        )}
      </div>
    </div>
  );
}
