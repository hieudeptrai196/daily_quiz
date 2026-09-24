// 2 prompt (sinh đề + kiểm tra chéo) và 2 JSON schema tương ứng.

export const GENERATOR_SYSTEM = `Bạn là người ra đề trắc nghiệm kỹ thuật cho một nhóm developer (backend / fullstack) đã đi làm.
Nhiệm vụ: tạo ĐÚNG 1 câu hỏi trắc nghiệm có 4 lựa chọn và CHỈ 1 đáp án đúng.

NỘI DUNG
- Kiểm tra hiểu biết thực chất: vì sao, khi nào dùng, đánh đổi, kết quả chạy code, chọn cách xử lý tình huống thực tế.
- KHÔNG hỏi định nghĩa học thuộc lòng, KHÔNG hỏi trivia (năm ra đời, ai tạo ra, viết tắt của chữ gì).
- Đáp án đúng phải đúng khách quan, không phụ thuộc ý kiến cá nhân. Nếu phụ thuộc phiên bản/công cụ/cấu hình mặc định thì ghi rõ trong đề.
- 3 đáp án sai phải hợp lý, là những hiểu nhầm phổ biến, nhưng chắc chắn sai.
- 4 đáp án có độ dài và văn phong tương đương để không đoán được bằng mẹo.
- KHÔNG dùng "Tất cả đều đúng", "Cả A và B", "Không có đáp án nào đúng" hay đáp án nào nhắc tới đáp án khác, vì thứ tự sẽ bị xáo trộn.
- KHÔNG ghi chữ cái A/B/C/D ở đầu đáp án.
- Nếu dùng code: code phải chạy đúng như bạn nói, không lỗi cú pháp, không phụ thuộc hành vi không xác định.

NGÔN NGỮ
- Viết tiếng Việt, giữ nguyên thuật ngữ tiếng Anh (index, cache, race condition, re-render, ...).

GIỚI HẠN ĐỘ DÀI (bắt buộc vì hiển thị trên Telegram poll)
- question: tối đa 250 ký tự.
- mỗi option: tối đa 90 ký tự.
- code: tối đa 20 dòng; để "" nếu không cần. Khi có code, question chỉ hỏi về đoạn code, KHÔNG chép code vào question.
- explanation: tối đa 400 ký tự; giải thích vì sao đáp án đúng và vì sao đáp án sai dễ nhầm nhất là sai. Không nhắc chữ cái A/B/C/D.
- summary: tối đa 80 ký tự, tóm tắt ý chính câu hỏi (dùng để tránh ra trùng).`;

export function buildGeneratorPrompt({ topicName, subtopic, style, difficulty, language, guidance, history }) {
  const codeLine = language
    ? `Được phép (không bắt buộc) kèm 1 đoạn code ngắn bằng ${language} nếu giúp câu hỏi hay hơn.`
    : 'KHÔNG dùng code, để trường code là "".';
  const guidanceBlock = guidance ? `\nYêu cầu thêm:\n${guidance}\n` : '';
  const historyLines = history && history.length ? history.map((s) => `- ${s}`).join('\n') : '(chưa có)';
  return `Chủ đề: ${topicName}
Chủ đề con: ${subtopic}
${style ? `Dạng câu hỏi: ${style}\n` : ''}Độ khó: ${difficulty}
${codeLine}
${guidanceBlock}
Các câu đã hỏi gần đây trong chủ đề này (KHÔNG hỏi lại ý tương tự):
${historyLines}

Trả về JSON đúng schema.`;
}

export const GENERATOR_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string', description: 'Câu hỏi, tối đa 250 ký tự' },
    code: { type: 'string', description: 'Đoạn code tối đa 20 dòng, hoặc "" nếu không dùng code' },
    options: {
      type: 'array',
      items: { type: 'string', description: 'Một lựa chọn, tối đa 90 ký tự, không có chữ cái A/B/C/D ở đầu' },
      minItems: 4,
      maxItems: 4,
    },
    correctIndex: { type: 'integer', minimum: 0, maximum: 3, description: 'Vị trí đáp án đúng trong options (0-3)' },
    explanation: { type: 'string', description: 'Giải thích, tối đa 400 ký tự' },
    summary: { type: 'string', description: 'Tóm tắt ý chính câu hỏi, tối đa 80 ký tự' },
  },
  required: ['question', 'code', 'options', 'correctIndex', 'explanation', 'summary'],
};

export const SOLVER_SYSTEM = `Bạn là kỹ sư phần mềm senior đang làm một bài trắc nghiệm.
Tự suy luận cẩn thận và độc lập từng đáp án, rồi chọn đúng 1 đáp án đúng nhất.
Đánh giá chất lượng đề: đặt "valid": false nếu câu hỏi mơ hồ, có từ 2 đáp án đúng trở lên, không có đáp án nào đúng, code có lỗi, hoặc kết quả phụ thuộc điều kiện không được nêu trong đề.
Cũng đặt "valid": false nếu có đáp án tự nhận xét làm lộ đúng/sai (ví dụ "(không an toàn)", "nhưng không idempotent", "không phù hợp"), hoặc nếu câu hỏi/đáp án không viết bằng tiếng Việt.`;

export function buildSolverPrompt({ question, code, codeTag, options }) {
  const letters = ['A', 'B', 'C', 'D'];
  const parts = [`Câu hỏi: ${question}`];
  if (code) parts.push(`Code:\n\`\`\`${codeTag || ''}\n${code}\n\`\`\``);
  parts.push(`Các lựa chọn:\n${options.map((o, i) => `${letters[i]}. ${o}`).join('\n')}`);
  parts.push('Trả về JSON đúng schema.');
  return parts.join('\n\n');
}

// reasoning đứng trước answer để model suy luận trước khi chọn
export const SOLVER_SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string', description: 'Suy luận ngắn gọn, tối đa 600 ký tự' },
    answer: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    valid: { type: 'boolean', description: 'false nếu đề có vấn đề' },
  },
  required: ['reasoning', 'answer', 'valid'],
  propertyOrdering: ['reasoning', 'answer', 'valid'],
};
