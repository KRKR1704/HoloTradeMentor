import React from 'react';
import { MOCK_LESSONS } from '../constants';
import { useAppContext } from '../context/AppContext';

const Learn: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;

    if (!currentUser) return null;

    const { lessonProgress } = currentUser;

    const handleCompleteLesson = async (lessonId: string) => {
        if (!currentUser || currentUser.lessonProgress.includes(lessonId)) {
            return;
        }

        const updatedLessonProgress = [...currentUser.lessonProgress, lessonId];
        const updatedUser = {
            ...currentUser,
            lessonProgress: updatedLessonProgress,
        };

        // FIX: The payload for COMPLETE_LESSON must be an object with an updatedUser property.
        dispatch({ type: 'COMPLETE_LESSON', payload: { updatedUser } });
    };

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      <h1 className="text-3xl font-bold">Learning Center</h1>
      <p className="text-muted-foreground">
        Start your investment journey here. Learn the basics and build your confidence.
      </p>

      <div className="space-y-4">
        {MOCK_LESSONS.map((lesson) => {
            const isCompleted = lessonProgress.includes(lesson.id);
            return (
                <div key={lesson.id} className="bg-card border border-slate-800 p-5 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-accent">{lesson.title}</h2>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            lesson.difficulty === 'Beginner' ? 'bg-green-900/50 text-positive' :
                            lesson.difficulty === 'Intermediate' ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-red-900/50 text-destructive'
                        }`}>
                            {lesson.difficulty}
                        </span>
                    </div>
                    <p className="mt-2 text-foreground">{lesson.content}</p>
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
    </div>
  );
};

export default Learn;
