import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { extractPdfText } from "../utils/extractPdfText";
import { generateQuestionsWithGemini } from "../utils/geminiClient";

interface CreateExamProps {
  teacherId: Id<"teachers">;
  onBack: () => void;
}

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

export function CreateExam({ teacherId, onBack }: CreateExamProps) {
  // ================= STATE =================
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [questions, setQuestions] = useState<Question[]>([
    { question: "", options: ["", "", "", ""], correctAnswer: 0 },
  ]);

  // ================= AI STATE =================
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [aiQuestionCount, setAiQuestionCount] = useState(5); // ✅ ADDED
  const [loadingAI, setLoadingAI] = useState(false);

  // ================= CONVEX =================
  const createExam = useMutation(api.exams.createExam);

  // ================= MANUAL FUNCTIONS =================
  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctAnswer: 0 },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  // ================= AI GENERATION =================
  const handleGenerateAI = async () => {
    if (!subject || !chapter) {
      toast.error("Please enter both Subject and Topic");
      return;
    }

    try {
      setLoadingAI(true);

      const aiQuestions = await generateQuestionsWithGemini(
        subject,
        chapter,
        aiQuestionCount // ✅ FIXED
      );

      if (!aiQuestions || aiQuestions.length === 0) {
        toast.error("AI returned no results. Try adjusting the topic.");
        return;
      }

      setQuestions(aiQuestions);
      toast.success("AI questions generated successfully!");
    } catch (err: any) {
      console.error("Gemini Error:", err);
      toast.error(err.message || "Gemini AI failed to respond.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    try {
      setLoadingAI(true);
      toast.info("Extracting content from PDF...");
      const pdfText = await extractPdfText(file);

      const aiQuestions = await generateQuestionsWithGemini(
        "PDF Document",
        "",
        aiQuestionCount // ✅ FIXED
      );

      setQuestions(aiQuestions);
      toast.success("Questions generated from PDF content!");
    } catch (err) {
      console.error("PDF Processing Error:", err);
      toast.error("Could not process PDF or generate questions.");
    } finally {
      setLoadingAI(false);
    }
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in Exam Title and Description");
      return;
    }

    const isReady = questions.every(
      (q) => q.question.trim() !== "" && q.options.every((opt) => opt.trim() !== "")
    );

    if (!isReady) {
      toast.error("Some questions or options are still empty.");
      return;
    }

    try {
      await createExam({
        title: title.trim(),
        description: description.trim(),
        teacherId,
        duration,
        questions,
      });

      toast.success("Exam published successfully!");
      onBack();
    } catch {
      toast.error("Error saving exam to the database.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"
          >
            <span className="text-xl">←</span>
          </button>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Create New Exam
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Exam Metadata */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Exam Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="e.g. Computer Networks Mid-Term"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Duration (Mins)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-semibold text-gray-600 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Provide instructions or a brief summary..."
              rows={3}
              required
            />
          </div>
        </div>

        {/* AI Generator Tools */}
        <div className="bg-indigo-900 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">AI Quick-Build</h3>
            <p className="text-indigo-200 text-sm mb-6">
              Let Gemini generate questions for you in seconds.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <input
                placeholder="Subject (e.g. DBMS)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 outline-none"
              />
              <input
                placeholder="Topic (e.g. Normalization)"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 outline-none"
              />
              <input
                type="number"
                min={1}
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                placeholder="No. of Questions"
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 outline-none"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={loadingAI}
                className="w-full md:w-auto px-8 py-3 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {loadingAI
                  ? "AI is Generating..."
                  : `Generate ${aiQuestionCount} MCQs`}
              </button>

              <div className="flex items-center gap-3 w-full md:w-auto border-l border-white/20 pl-4">
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                  Or PDF
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  className="text-xs file:bg-indigo-700 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-lg file:mr-4 file:font-bold hover:file:bg-indigo-600 cursor-pointer"
                  onChange={(e) =>
                    e.target.files && handlePdfUpload(e.target.files[0])
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Question List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">
              Questions ({questions.length})
            </h3>
            <button
              type="button"
              onClick={addQuestion}
              className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              + Add Question
            </button>
          </div>

          {questions.map((q, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm group hover:border-blue-200 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-black uppercase tracking-tighter">
                  Question {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>

              <input
                type="text"
                value={q.question}
                onChange={(e) =>
                  updateQuestion(i, "question", e.target.value)
                }
                className="w-full text-xl font-bold text-gray-800 border-b border-gray-100 focus:border-blue-500 py-2 outline-none mb-6 bg-transparent"
                placeholder="Enter your question here..."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      q.correctAnswer === oi
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correctAnswer === oi}
                      onChange={() =>
                        updateQuestion(i, "correctAnswer", oi)
                      }
                      className="w-5 h-5 text-green-600 focus:ring-green-500"
                    />
                    <input
                      value={opt}
                      onChange={(e) =>
                        updateOption(i, oi, e.target.value)
                      }
                      className="w-full bg-transparent font-medium text-gray-700 outline-none"
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Final Actions */}
        <div className="flex items-center justify-end gap-6 pt-10 border-t border-gray-200">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-500 font-bold hover:text-gray-800 transition-colors"
          >
            Discard Changes
          </button>
          <button
            type="submit"
            className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all"
          >
            Create & Launch Exam
          </button>
        </div>
      </form>
    </div>
  );
}
