
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Check, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const TajwidDictionary = () => {
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    // This is placeholder data. Ideally, fetch this from Supabase.
    const tajwidData = [
      { id: 1, term: 'Ikhfa', definition: 'Menyamarkan atau membunyikan antara Izhar dan Idgham, siap untuk didengungkan.' },
      { id: 2, term: 'Idgham', definition: 'Menggabungkan atau memasukkan huruf pertama ke huruf kedua.' },
      { id: 3, term: 'Iqlab', definition: 'Mengganti bunyi huruf Nun Sukun atau Tanwin menjadi Mim.' },
      { id: 4, term: 'Izhar', definition: 'Membaca huruf Nun Sukun atau Tanwin dengan jelas tanpa dengung.' },
      { id: 5, term: 'Qalqalah', definition: 'Memantulkan bunyi huruf pada huruf-huruf tertentu saat sukun.' },
    ];
    setTerms(tajwidData);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <h2 className="text-3xl font-bold text-center mb-8 text-accent-foreground">Kamus Tajwid Mini</h2>
      <div className="space-y-4">
        {terms.map(item => (
          <Card key={item.id} className="bg-card">
            <CardHeader>
              <CardTitle className="text-primary">{item.term}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{item.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
};

const letters = [
    { char: 'ا', name: 'Alif' }, { char: 'ب', name: 'Ba' }, { char: 'ت', name: 'Ta' }, { char: 'ث', name: 'Tsa' },
    { char: 'ج', name: 'Jim' }, { char: 'ح', name: 'Ha' }, { char: 'خ', name: 'Kho' }, { char: 'د', name: 'Dal' },
    { char: 'ذ', name: 'Dzal' }, { char: 'ر', name: 'Ro' }, { char: 'ز', name: 'Zay' }, { char: 'س', name: 'Sin' },
    { char: 'ش', name: 'Syin' }, { char: 'ص', name: 'Shod' }, { char: 'ض', name: 'Dhod' }, { char: 'ط', name: 'Tho' },
    { char: 'ظ', name: 'Zho' }, { char: 'ع', name: 'Ain' }, { char: 'غ', name: 'Ghoin' }, { char: 'ف', name: 'Fa' },
    { char: 'ق', name: 'Qof' }, { char: 'ك', name: 'Kaf' }, { char: 'ل', name: 'Lam' }, { char: 'م', name: 'Mim' },
    { char: 'ن', name: 'Nun' }, { char: 'ه', name: 'Ha' }, { char: 'و', name: 'Waw' }, { char: 'ي', name: 'Ya' },
];

const HijaiyahGame = () => {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const generateQuestion = useCallback(() => {
    setFeedback(null);
    const correctLetter = letters[Math.floor(Math.random() * letters.length)];
    let tempOptions = [correctLetter.name];
    
    while (tempOptions.length < 4) {
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      if (!tempOptions.includes(randomLetter.name)) {
        tempOptions.push(randomLetter.name);
      }
    }

    setCurrentQuestion(correctLetter);
    setOptions(tempOptions.sort(() => Math.random() - 0.5));
  }, []);

  useEffect(() => {
    generateQuestion();
  }, [generateQuestion]);

  const handleAnswer = (option) => {
    if (feedback) return;

    if (option === currentQuestion.name) {
      setFeedback('correct');
      toast({ title: "Benar!", description: "Jawaban Anda benar!", className: "bg-green-500 text-white" });
      setTimeout(generateQuestion, 1500);
    } else {
      setFeedback('incorrect');
      toast({ title: "Salah!", description: "Coba lagi ya!", variant: "destructive" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  if (!currentQuestion) {
    return <div>Memuat permainan...</div>;
  }
  
  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
      <h2 className="text-3xl font-bold text-center mb-8 text-accent-foreground">Game Tebak Huruf Hijaiyah</h2>
      <Card className="max-w-md mx-auto">
        <CardHeader className="items-center">
          <div className="text-9xl font-arabic mb-4 p-8 bg-primary/10 rounded-full text-primary">
            {currentQuestion.char}
          </div>
          <CardTitle>Huruf apakah ini?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {options.map((option, index) => (
              <Button
                key={option}
                onClick={() => handleAnswer(option)}
                variant="outline"
                className="h-16 text-lg justify-start"
                disabled={!!feedback}
              >
                <span className="font-bold mr-3">{optionLabels[index]}.</span> {option}
              </Button>
            ))}
          </div>
          <div className="h-10 mt-4 flex items-center justify-center">
            {feedback === 'correct' && <Check className="w-10 h-10 text-green-500" />}
            {feedback === 'incorrect' && <X className="w-10 h-10 text-red-500" />}
          </div>
          <Button onClick={generateQuestion} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" /> Soal Berikutnya
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EduMediaPage = () => {
  return (
    <>
      <Helmet>
        <title>Media Edukatif - LPQ Al-Muhajirun</title>
        <meta name="description" content="Jelajahi media edukatif Islami, termasuk game tebak huruf hijaiyah dan kamus tajwid mini, untuk pembelajaran yang menyenangkan." />
      </Helmet>
      <div className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-extrabold text-center mb-12 text-primary"
          >
            Media Edukatif
          </motion.h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <HijaiyahGame />
            <TajwidDictionary />
          </div>
        </div>
      </div>
    </>
  );
};

export default EduMediaPage;
