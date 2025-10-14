import React from 'react';
import { Reference } from '../types';

interface ReferencesProps {
  references: Reference[];
  className?: string;
}

export const References: React.FC<ReferencesProps> = ({ references, className = '' }) => {
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
        References:
      </h4>
      <div className="text-sm text-gray-700 dark:text-gray-300">
        {references.map((ref, index) => (
          <span key={ref.id}>
            [{ref.id}]{''}
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline transition-colors duration-200"
              title={ref.title}
            >
              {ref.title}
            </a>
            {index < references.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};