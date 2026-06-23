
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BrainCircuit, CheckCircle, XCircle, ChevronRight, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';

const quizQuestions = [
    { question: "Apa hukum bacaan nun sukun (نْ) atau tanwin bertemu huruf ba (ب)?", options: ["Idgham", "Ikhfa", "Iqlab", "Idzhar"], answer: "Iqlab" },
    { question: "Huruf-huruf Qalqalah terkumpul dalam lafaz...", options: ["يَرْمَلُوْنَ", "قُطْبُ جَدٍّ", "أَنْعَمْتَ", "يَنْصُرُكُمْ"], answer: "قُطْبُ جَدٍّ" },
    { question: "Bacaan Mad Thabi'i dibaca sepanjang...", options: ["1 harakat", "2 harakat", "4 harakat", "6 harakat"], answer: "2 harakat" },
    { question: "Ketika ada mim sukun (مْ) bertemu dengan huruf mim (م), hukum bacaannya adalah...", options: ["Ikhfa Syafawi", "Idgham Mitslain", "Idzhar Syafawi", "Qalqalah"], answer: "Idgham Mitslain" },
    { question: "Manakah di antara berikut yang termasuk huruf Idzhar Halqi?", options: ["ق", "ب", "ي", "ء"], answer: "ء" },
    { question: "Bacaan 'Alif Lam' yang dibaca jelas disebut...", options: ["Alif Lam Syamsiyah", "Alif Lam Qamariyah", "Mad Lazim", "Mad Wajib"], answer: "Alif Lam Qamariyah" },
        { question: "Berapa jumlah huruf Idgham Bighunnah?", options: ["2", "4", "6", "8"], answer: "4" },
    { question: "Tanda waqaf (لا) berarti...", options: ["Harus berhenti", "Boleh berhenti, boleh lanjut", "Lebih baik lanjut", "Dilarang berhenti"], answer: "Dilarang berhenti" },
    { question: "Ghunnah artinya adalah...", options: ["Memantul", "Dengung", "Jelas", "Samar-samar"], answer: "Dengung" },
    { question: "Huruf 'Ra' (ر) yang dibaca tebal (tafkhim) adalah ketika berharakat...", options: ["Kasrah", "Fathah atau Dhammah", "Sukun", "Kasratain"], answer: "Fathah atau Dhammah" }
];

const IslamicQuiz = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  const handleAnswerOptionClick = (option) => {
    setSelectedAnswer(option);
    const correct = option === quizQuestions[currentQuestion].answer;
    setIsCorrect(correct);
    if (correct) {
      setScore(score + 1);
    }

    setTimeout(() => {
      const nextQuestion = currentQuestion + 1;
      if (nextQuestion < quizQuestions.length) {
        setCurrentQuestion(nextQuestion);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        setShowScore(true);
      }
    }, 1500);
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
    setSelectedAnswer(null);
    setIsCorrect(null);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: true }} 
      transition={{ duration: 0.5, delay: 0.4 }}
      className="mt-16"
    >
      <Card className="bg-white dark:bg-[#112D4E] shadow-xl border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-primary flex items-center justify-center gap-2">
            <BrainCircuit className="w-8 h-8" />
            Tes Pengetahuan Islami
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showScore ? (
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-4">Anda menjawab {score} dari {quizQuestions.length} pertanyaan dengan benar!</h3>
              <Button onClick={restartQuiz}>Coba Lagi</Button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h4 className="text-lg font-semibold">Pertanyaan {currentQuestion + 1}/{quizQuestions.length}</h4>
                <p className="mt-1">{quizQuestions[currentQuestion].question}</p>
              </div>
              <div className="space-y-3">
                {quizQuestions[currentQuestion].options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  let buttonClass = "w-full justify-start";
                  if (isSelected) {
                    buttonClass += isCorrect ? " bg-green-500 hover:bg-green-600" : " bg-red-500 hover:bg-red-600";
                  }
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      className={buttonClass}
                      onClick={() => handleAnswerOptionClick(option)}
                      disabled={selectedAnswer !== null}
                    >
                      {isSelected && (isCorrect ? <CheckCircle className="mr-2 h-4 w-4"/> : <XCircle className="mr-2 h-4 w-4"/>)}
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ParentingPage = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchArticles = async () => {
            const { data, error } = await supabase
                .from('website_content')
                .select('content')
                .eq('key', 'parentingArticles')
                .single();

            if (error && error.code !== 'PGRST116') {
                 console.error("Error fetching parenting articles:", error);
            } else if (data) {
                setArticles(data.content || []);
            }
            setLoading(false);
        };
        fetchArticles();
    }, []);

    const formatDate = (dateString) => {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString('id-ID', options);
    };

    return (
    <>
      <Helmet>
        <title>Parenting - LPQ Al-Muhajirun</title>
        <meta name="description" content="Artikel dan informasi parenting Islami dari LPQ Al-Muhajirun." />
      </Helmet>
      <div className="py-20 bg-gray-50 dark:bg-[#0a1929]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-[#112D4E] dark:text-white mb-4">Pojok Parenting Islami</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">Kumpulan artikel dan tips untuk mendukung peran orang tua sebagai pendidik utama di rumah.</p>
          </motion.div>

          {loading ? (
             <p className="text-center">Memuat artikel...</p>
          ) : articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article, index) => (
                    <motion.div 
                        key={article.id}
                        initial={{ opacity: 0, y: 50 }} 
                        whileInView={{ opacity: 1, y: 0 }} 
                        viewport={{ once: true }} 
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                        <Card className="bg-white dark:bg-[#112D4E] shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden h-full flex flex-col">
                            <img src={article.image_url} alt={article.title} className="w-full h-48 object-cover"/>
                            <CardHeader>
                                <CardTitle className="text-xl font-bold text-[#112D4E] dark:text-white line-clamp-2">{article.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">{article.summary}</p>
                                <div className="text-sm text-gray-500 dark:text-gray-500 flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    <span>{article.author}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <Clock className="w-4 h-4" />
                                     <span>{formatDate(article.date)}</span>
                                  </div>
                                </div>
                            </CardContent>
                             <div className="p-6 pt-0">
                                <Button asChild variant="link" className="p-0 h-auto text-primary">
                                    <Link to={`/parenting/${article.id}`}>
                                        Baca Selengkapnya <ChevronRight className="w-4 h-4 ml-1" />
                                    </Link>
                                </Button>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>
          ) : (
            <p className="text-center col-span-full">Belum ada artikel yang dipublikasikan.</p>
          )}
          
          <IslamicQuiz />

        </div>
      </div>
    </>
    );
};

export default ParentingPage;
