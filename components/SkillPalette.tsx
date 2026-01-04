'use client';

import { useState, useEffect, useRef } from 'react';

interface Skill {
  name: string;
  description: string;
  source: 'global' | 'local';
}

interface SkillPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSkill: (skillName: string) => void;
  skills: Skill[];
}

export default function SkillPalette({ isOpen, onClose, onSelectSkill, skills }: SkillPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter skills based on search
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(search.toLowerCase()) ||
    skill.description.toLowerCase().includes(search.toLowerCase())
  );

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredSkills.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSkills[selectedIndex]) {
          onSelectSkill(filteredSkills[selectedIndex].name);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredSkills, selectedIndex, onSelectSkill, onClose]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border)'
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Skills list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem'
        }}>
          {filteredSkills.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--text-tertiary)'
            }}>
              No skills found
            </div>
          ) : (
            filteredSkills.map((skill, index) => (
              <div
                key={skill.name}
                onClick={() => {
                  onSelectSkill(skill.name);
                  onClose();
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  background: index === selectedIndex ? 'rgba(139, 92, 70, 0.1)' : 'transparent',
                  border: index === selectedIndex ? '1px solid var(--accent)' : '1px solid transparent',
                  marginBottom: '0.25rem',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.25rem'
                }}>
                  <span style={{
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: '0.875rem'
                  }}>
                    /{skill.name}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    background: skill.source === 'local'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(139, 92, 70, 0.1)',
                    color: skill.source === 'local' ? '#3b82f6' : 'var(--accent)',
                    fontWeight: 500
                  }}>
                    {skill.source}
                  </span>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4'
                }}>
                  {skill.description}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '1.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-geist-mono)'
        }}>
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>

      <style jsx>{`
        kbd {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 0.25rem;
          padding: 0.125rem 0.375rem;
          font-family: var(--font-geist-mono);
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
