const source = 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954';

export const examQuestions = [
  {
    id: 'geneva-context', source,
    question: 'Hiệp định nào tạo bối cảnh cho cuộc di cư Bắc – Nam năm 1954?',
    options: ['Hiệp định Paris', 'Hiệp định Giơnevơ', 'Hiệp định Sơ bộ', 'Hiệp định Élysée'], answer: 1,
  },
  {
    id: 'migration-direction', source,
    question: 'Cuộc di cư được đề cập trong bài chủ yếu diễn ra theo hướng nào?',
    options: ['Miền Nam ra miền Bắc', 'Việt Nam sang Pháp', 'Miền Bắc sang Trung Quốc', 'Miền Bắc vào miền Nam'], answer: 3,
  },
  {
    id: 'article-14d', source,
    question: 'Điều khoản nào của Hiệp định đình chỉ chiến sự cho phép thường dân chuyển vùng cư trú?',
    options: ['Điều 14(d)', 'Điều 1', 'Điều 20', 'Điều 35'], answer: 0,
  },
  {
    id: '300-days', source,
    question: 'Thời hạn chuyển quân được Hiệp định Giơnevơ quy định tối đa bao nhiêu ngày?',
    options: ['90 ngày', '180 ngày', '300 ngày', '365 ngày'], answer: 2,
  },
  {
    id: 'diem-political-goal', source,
    question: 'Một mục tiêu chính trị của việc thúc đẩy di cư vào Nam là gì?',
    options: ['Phát triển du lịch', 'Củng cố cơ sở ủng hộ chính quyền Ngô Đình Diệm', 'Xóa bỏ toàn bộ tôn giáo', 'Đưa dân cư sang Mỹ'], answer: 1,
  },
  {
    id: 'catholic-anticommunist', source,
    question: 'Nhóm dân cư nào được chính quyền Diệm đặc biệt quan tâm thu hút vào Nam?',
    options: ['Người nước ngoài', 'Chỉ quân nhân Pháp', 'Chỉ công nhân công nghiệp', 'Người Công giáo và các thành phần chống cộng'], answer: 3,
  },
  {
    id: 'passage-to-freedom', source,
    question: 'Chiến dịch vận chuyển người di cư do Hải quân Mỹ thực hiện có tên gì?',
    options: ['Rolling Thunder', 'Linebacker', 'Passage to Freedom', 'Market Time'], answer: 2,
  },
  {
    id: 'ships-planes', source,
    question: 'Phương tiện chủ yếu được sử dụng để đưa người di cư vào Nam là gì?',
    options: ['Tàu biển và máy bay', 'Xe đạp và xe máy', 'Tàu điện ngầm', 'Chỉ đi bộ'], answer: 0,
  },
  {
    id: 'propaganda', source,
    question: 'Nội dung nào được sử dụng trong tuyên truyền vận động người dân di cư?',
    options: ['Khuyến khích du lịch quốc tế', 'Tuyên truyền về thể thao', 'Giới thiệu chương trình du học', 'Khơi gợi lo ngại về tôn giáo, tài sản và an toàn'], answer: 3,
  },
  {
    id: 'land-promise', source,
    question: 'Lời hứa nào được sử dụng để thu hút người dân vào Nam?',
    options: ['Miễn toàn bộ nghĩa vụ công dân', 'Hỗ trợ đất đai và điều kiện định cư', 'Đưa tất cả người dân ra nước ngoài', 'Phát vàng cho mọi gia đình'], answer: 1,
  },
  {
    id: 'mixed-motives', source,
    question: 'Nhận định nào đúng nhất về nguyên nhân người dân di cư năm 1954–1955?',
    options: ['Tất cả bị ép buộc', 'Tất cả chỉ vì kinh tế', 'Có nhiều động cơ đan xen như tôn giáo, gia đình, chính trị và sinh kế', 'Tất cả đều là quân nhân'], answer: 2,
  },
  {
    id: 'nearly-one-million', source,
    question: 'Quy mô người di cư từ Bắc vào Nam năm 1954–1955 thường được khái quát khoảng bao nhiêu?',
    options: ['Gần 1 triệu người', '10.000 người', '50.000 người', '5 triệu người'], answer: 0,
  },
  {
    id: 'settlement-hardship', source,
    question: 'Khó khăn lớn trong quá trình ổn định đời sống người di cư tại miền Nam là gì?',
    options: ['Không có phương tiện truyền thông', 'Không có bất kỳ hoạt động cứu trợ nào', 'Không có người dân tham gia di cư', 'Thiếu đất canh tác, công cụ sản xuất và điều kiện định cư ổn định'], answer: 3,
  },
  {
    id: 'heath-telegram', source,
    question: 'Điện tín ngày 23/7/1954 ghi nhận đề nghị Mỹ hỗ trợ di cư của Ngô Đình Diệm do ai gửi?',
    options: ['Dwight Eisenhower', 'Donald Heath', 'Henry Kissinger', 'John F. Kennedy'], answer: 1,
  },
  {
    id: 'distinguish-goals', source,
    question: 'Khi đánh giá chính sách di cư năm 1954, cần phân biệt điều gì?',
    options: ['Di cư đường biển và đường bộ', 'Người trẻ và người già', 'Mục tiêu chính trị của chính quyền với động cơ cá nhân của người di cư', 'Miền núi và đồng bằng'], answer: 2,
  },
];

const explanations = {
  'geneva-context': 'Hiệp định Giơnevơ năm 1954 quy định việc đình chỉ chiến sự, tập kết quân đội và tạo cơ sở pháp lý cho thường dân chuyển vùng cư trú trong thời hạn chuyển quân.',
  'migration-direction': 'Sau Hiệp định Giơnevơ, một bộ phận lớn dân cư miền Bắc di chuyển vào miền Nam trong giai đoạn 1954–1955.',
  'article-14d': 'Điều 14(d) quy định thường dân muốn chuyển sang vùng bên kia phải được chính quyền địa phương cho phép và giúp đỡ trong thời hạn chuyển quân.',
  '300-days': 'Hiệp định quy định thời hạn tối đa 300 ngày để hoàn thành việc tập kết và chuyển quân. Đây cũng là thời kỳ thường dân được thực hiện quyền chuyển vùng theo Điều 14(d).',
  'diem-political-goal': 'Mỹ và chính quyền Diệm xem việc thu hút dân cư miền Bắc, đặc biệt những người được kỳ vọng có lập trường chống cộng, là một biện pháp củng cố lực lượng chính trị và xã hội ở miền Nam.',
  'catholic-anticommunist': 'Trong các trao đổi ngoại giao năm 1954, Ngô Đình Diệm đề nghị Mỹ hỗ trợ đưa những người Công giáo và các nhóm chống cộng từ miền Bắc vào miền Nam.',
  'passage-to-freedom': 'Operation Passage to Freedom là chiến dịch Hải quân Mỹ tham gia vận chuyển người di cư từ miền Bắc vào miền Nam sau Hiệp định Giơnevơ.',
  'ships-planes': 'Mỹ và Pháp sử dụng tàu biển, máy bay để vận chuyển người di cư. Tàu biển đảm nhận phần lớn số người được chuyên chở.',
  'propaganda': 'Một số hoạt động tuyên truyền nhấn mạnh những lo ngại về tự do tôn giáo, quyền sở hữu tài sản và sự an toàn nhằm vận động người dân lựa chọn vào Nam.',
  'land-promise': 'Chính quyền Diệm và các tổ chức hỗ trợ di cư đưa ra những triển vọng về nhà ở, đất đai và sinh kế, tuy nhiên việc thực hiện trên thực tế gặp nhiều khó khăn.',
  'mixed-motives': 'Người dân ra đi vì nhiều nguyên nhân khác nhau. Có người lo ngại về chính trị, tôn giáo, có người đi theo gia đình hoặc tìm kiếm điều kiện sinh sống tốt hơn. Không nên quy tất cả trường hợp vào một nguyên nhân duy nhất.',
  'nearly-one-million': 'Các tài liệu lịch sử thường nêu khoảng 800.000 đến gần một triệu người di cư từ miền Bắc vào miền Nam. Con số cụ thể thay đổi tùy nguồn và cách thống kê.',
  'settlement-hardship': 'Việc vận chuyển người di cư chỉ là bước đầu. Nhiều người còn gặp khó khăn về nhà ở, đất sản xuất, công cụ lao động và việc làm sau khi đến miền Nam.',
  'heath-telegram': 'Donald Heath là Đại sứ Mỹ tại Việt Nam, người gửi điện tín ngày 23/7/1954 ghi nhận đề nghị hỗ trợ di cư từ phía Ngô Đình Diệm.',
  'distinguish-goals': 'Mỹ và chính quyền Diệm có những mục tiêu chính trị trong việc hỗ trợ và tổ chức di cư. Tuy nhiên, từng người dân có hoàn cảnh và lý do riêng, có thể tự nguyện, chịu ảnh hưởng tuyên truyền hoặc bị gây sức ép.',
};

for (const question of examQuestions) question.explanation = explanations[question.id] || '';

export const publicExamQuestions = examQuestions.map(({ id, question, options }) => ({ id, question, options }));
export const hostExamQuestions = examQuestions.map(({ id, question, options, answer, explanation }) => ({
  id, question, options, answer, explanation,
}));
export const perfectExamAnswers = examQuestions.map(question => question.answer);
