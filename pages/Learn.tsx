import React, { useEffect, useMemo, useState } from 'react';
import { MOCK_LESSONS } from '../constants';
import { useAppContext } from '../context/AppContext';
import { Lesson } from '../types';
import { askAI, fetchLearnLessons } from '../services/aiService';
import { completeLesson } from '../services/userService';

const Learn: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;
    const [lessons, setLessons] = useState<Lesson[]>(MOCK_LESSONS);
    const [loadedLessons, setLoadedLessons] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiQuestion, setAiQuestion] = useState('');
    const [aiHistory, setAiHistory] = useState<{ question: string; response: string }[]>([]);
    const [aiLoading, setAiLoading] = useState(false);

    const refreshLessons = async (completedIds: string[] = []) => {
        setLoading(true);
        setError(null);
        const dynamicLessons = await fetchLearnLessons(completedIds);
        if (dynamicLessons.length > 0) {
            setLessons(dynamicLessons.filter((lesson) => !completedIds.includes(lesson.id)).sort((a, b) => (a.level ?? 0) - (b.level ?? 0)));
            setLoadedLessons(true);
        } else {
            setError('Unable to load lessons from the mentor service. Showing starter lessons instead.');
            setLoadedLessons(false);
            setLessons(MOCK_LESSONS.filter((lesson) => !completedIds.includes(lesson.id)));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!currentUser) return;
        refreshLessons(currentUser.lessonProgress);
    }, [currentUser]);

    if (!currentUser) return null;

    const { lessonProgress } = currentUser;

    const orderedLessons = useMemo(() => {
        const completed = new Set(lessonProgress);
        return lessons
            .slice()
            .sort((a, b) => {
                const aDone = completed.has(a.id) ? 1 : 0;
                const bDone = completed.has(b.id) ? 1 : 0;
                if (aDone !== bDone) return aDone - bDone;
                return (a.level ?? 0) - (b.level ?? 0);
            });
    }, [lessons, lessonProgress]);

    const allCompleted = lessons.length > 0 && lessons.every((lesson) => lessonProgress.includes(lesson.id));

    const currentLesson = useMemo(() => {
        return orderedLessons.find((lesson) => !lessonProgress.includes(lesson.id)) || orderedLessons[0] || null;
    }, [orderedLessons, lessonProgress]);

    const handleCompleteLesson = async (lessonId: string) => {
        if (!currentUser || lessonProgress.includes(lessonId)) {
            return;
        }

        setLoading(true);
        setError(null);
        const updatedUser = await completeLesson(lessonId);
        setLoading(false);

        const newProgress = updatedUser ? updatedUser.lessonProgress : [...lessonProgress, lessonId];

        if (updatedUser) {
            dispatch({ type: 'COMPLETE_LESSON', payload: { updatedUser } });
        } else {
            const updatedUserFallback = { ...currentUser, lessonProgress: newProgress };
            dispatch({ type: 'COMPLETE_LESSON', payload: { updatedUser: updatedUserFallback } });
            setError('Lesson marked complete locally. Backend save failed.');
        }

        await refreshLessons(newProgress);
    };

    const handleAskQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiQuestion.trim()) return;

        setAiLoading(true);
        const context = currentLesson ? `${currentLesson.title}

${currentLesson.content}` : undefined;
        try {
            const answer = await askAI(aiQuestion, context);
            const nextEntry = { question: aiQuestion.trim(), response: answer };
            setAiHistory((prev) => [nextEntry, ...prev]);
            setAiQuestion('');
        } catch (error) {
            console.error('AI question error', error);
            const nextEntry = {
                question: aiQuestion.trim(),
                response: "I'm having trouble connecting right now. Please try again in a moment.",
            };
            setAiHistory((prev) => [nextEntry, ...prev]);
            setAiQuestion('');
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Learning Center</h1>
                    <p className="text-muted-foreground">
                        Start your investment journey here. Learn the basics, then unlock higher levels as you progress.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {loadedLessons ? 'Lesson content is loaded from the mentor service.' : 'Showing starter lessons until the mentor service is available.'}
                    </p>
                </div>
                <button
                    onClick={async () => {
                        if (!currentUser) return;
                        await refreshLessons(currentUser.lessonProgress);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
                >
                    Refresh Lessons
                </button>
            </div>

            {loading && (
                <div className="rounded-lg border border-slate-800 bg-card p-4 text-sm text-muted-foreground">
                    Loading lessons from the mentor service...
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                </div>
            )}

            {allCompleted && (
                <div className="rounded-lg border border-slate-800 bg-card p-4 text-sm text-foreground">
                    Congratulations — you have completed all available learning modules.
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
                <div className="space-y-4">
                    {orderedLessons.map((lesson) => {
                    const isCompleted = lessonProgress.includes(lesson.id);
                    return (
                        <div id={`lesson-${lesson.id}`} key={lesson.id} className="bg-card border border-slate-800 p-5 rounded-lg shadow-sm">
                            <div className="flex justify-between items-center gap-4 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-bold text-accent">{lesson.title}</h2>
                                    {lesson.level != null && (
                                        <div className="mt-1 text-sm text-muted-foreground">Level {lesson.level}</div>
                                    )}
                                </div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                    lesson.difficulty === 'Beginner' ? 'bg-green-900/50 text-positive' :
                                    lesson.difficulty === 'Intermediate' ? 'bg-yellow-900/50 text-yellow-400' :
                                    'bg-red-900/50 text-destructive'
                                }`}>
                                    {lesson.difficulty}
                                </span>
                            </div>
                            <div className="mt-2 text-foreground">
                                {lesson.content}
                            </div>
                            {lesson.sections && lesson.sections.length > 0 && (
                                <div className="mt-4 space-y-4">
                                    {lesson.sections.map((section, sectionIndex) => (
                                        <div key={`${lesson.id}-section-${sectionIndex}`}>
                                            {section.title && (
                                                <h3 className="text-sm font-semibold text-accent">{section.title}</h3>
                                            )}
                                            <p className="mt-1 text-foreground">{section.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {lesson.resources && lesson.resources.length > 0 && (
                                <div className="mt-4 border-t border-slate-700 pt-4">
                                    <p className="text-sm text-muted-foreground">Further reading:</p>
                                    <ul className="mt-2 space-y-2">
                                        {lesson.resources.map((resource, resourceIndex) => (
                                            <li key={`${lesson.id}-resource-${resourceIndex}`}>
                                                <a
                                                    href={resource.url}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="text-primary hover:underline"
                                                >
                                                    {resource.label}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="mt-4">
                                <button
                                    onClick={() => handleCompleteLesson(lesson.id)}
                                    disabled={isCompleted}
                                    className="px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:bg-muted"
                                >
                                    {isCompleted ? 'Completed' : 'Mark as Completed'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

                <div className="space-y-4">
                    <div className="bg-card border border-slate-800 p-5 rounded-lg shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-accent">AI Assistant</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Ask questions anytime while you learn. The assistant can use the current lesson context if available.
                                </p>
                            </div>
                        </div>
                        {currentLesson && (
                            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/5 p-4">
                                <p className="text-sm text-muted-foreground">Current lesson context:</p>
                                <p className="mt-2 text-foreground">
                                    <strong>{currentLesson.title}</strong>
                                    <br />
                                    {currentLesson.content}
                                </p>
                            </div>
                        )}
                        <form onSubmit={handleAskQuestion} className="mt-4 space-y-3">
                            <textarea
                                value={aiQuestion}
                                onChange={(e) => setAiQuestion(e.target.value)}
                                placeholder="Ask the AI assistant anything about this lesson or investing..."
                                className="w-full min-h-[140px] rounded-lg border border-slate-800 bg-background p-3 text-foreground resize-none"
                            />
                            <button
                                type="submit"
                                disabled={aiLoading || !aiQuestion.trim()}
                                className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {aiLoading ? 'Thinking...' : 'Ask the assistant'}
                            </button>
                        </form>
                        <div className="mt-6 space-y-4">
                            {aiHistory.length > 0 ? (
                                aiHistory.map((item, index) => (
                                    <div key={index} className="rounded-lg border border-slate-800 bg-card p-4">
                                        <p className="text-sm font-semibold text-foreground">You asked:</p>
                                        <p className="mt-1 text-foreground">{item.question}</p>
                                        <p className="mt-3 text-sm font-semibold text-foreground">Assistant:</p>
                                        <p className="mt-1 text-foreground whitespace-pre-wrap">{item.response}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-lg border border-slate-800 bg-card p-4 text-sm text-muted-foreground">
                                    Ask a question to start the conversation.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Learn;
