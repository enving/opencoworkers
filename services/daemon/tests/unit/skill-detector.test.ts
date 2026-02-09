import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SkillDetector } from '../../skills/detector.js';

describe('SkillDetector', () => {
  let detector: SkillDetector;

  beforeEach(() => {
    detector = new SkillDetector();
  });

  describe('Label-based detection', () => {
    it('should detect pptx skill from presentation label', async () => {
      const skill = detector.detectSkillFromLabels(['presentation']);
      expect(skill).toBe('pptx');
    });

    it('should detect xlsx skill from excel label', async () => {
      const skill = detector.detectSkillFromLabels(['excel']);
      expect(skill).toBe('xlsx');
    });

    it('should detect calendar skill from meeting label', async () => {
      const skill = detector.detectSkillFromLabels(['meeting']);
      expect(skill).toBe('calendar');
    });

    it('should detect email skill from mail label', async () => {
      const skill = detector.detectSkillFromLabels(['mail']);
      expect(skill).toBe('email');
    });

    it('should return null for unknown labels', async () => {
      const skill = detector.detectSkillFromLabels(['unknown']);
      expect(skill).toBeNull();
    });

    it('should handle partial matches', async () => {
      const skill = detector.detectSkillFromLabels(['presentation-slides']);
      expect(skill).toBe('pptx');
    });
  });

  describe('Category-based detection', () => {
    it('should detect pptx skill from presentation category', async () => {
      const skill = detector.detectSkillFromCategory('presentation');
      expect(skill).toBe('pptx');
    });

    it('should detect xlsx skill from data-analysis category', async () => {
      const skill = detector.detectSkillFromCategory('data-analysis');
      expect(skill).toBe('xlsx');
    });

    it('should return null for unknown categories', async () => {
      const skill = detector.detectSkillFromCategory('unknown');
      expect(skill).toBeNull();
    });
  });

  describe('Description-based detection', () => {
    it('should detect pptx skill from presentation description', async () => {
      const skill = detector.detectSkillFromDescription('Create a PowerPoint presentation');
      expect(skill).toBe('pptx');
    });

    it('should detect xlsx skill from excel description', async () => {
      const skill = detector.detectSkillFromDescription('Analyze data in Excel spreadsheet');
      expect(skill).toBe('xlsx');
    });

    it('should detect calendar skill from schedule description', async () => {
      const skill = detector.detectSkillFromDescription('Schedule a meeting');
      expect(skill).toBe('calendar');
    });

    it('should return null for generic descriptions', async () => {
      const skill = detector.detectSkillFromDescription('Do some work');
      expect(skill).toBeNull();
    });
  });

  describe('Multi-strategy detection', () => {
    it('should prioritize labels over category', async () => {
      const skill = await detector.detectSkill({
        labels: ['excel'],
        category: 'presentation',
        description: 'Create a document'
      });
      expect(skill).toBe('xlsx');
    });

    it('should use category when no labels match', async () => {
      const skill = await detector.detectSkill({
        labels: ['unknown'],
        category: 'data-analysis',
        description: 'Create a document'
      });
      expect(skill).toBe('xlsx');
    });

    it('should use description when no labels or category match', async () => {
      const skill = await detector.detectSkill({
        labels: ['unknown'],
        category: 'unknown',
        description: 'Create a PowerPoint presentation'
      });
      expect(skill).toBe('pptx');
    });

    it('should use existing skill if provided', async () => {
      const skill = await detector.detectSkill({
        labels: ['presentation'],
        category: 'data-analysis',
        description: 'Create a document',
        existingSkill: 'email'
      });
      expect(skill).toBe('email');
    });

    it('should fallback to general when no detection works', async () => {
      const skill = await detector.detectSkill({
        labels: ['unknown'],
        category: 'unknown',
        description: 'Do some generic work'
      });
      expect(skill).toBe('general');
    });
  });

  describe('Custom mappings', () => {
    it('should allow adding custom label mappings', async () => {
      detector.addLabelMapping('custom-label', 'pptx');
      const skill = detector.detectSkillFromLabels(['custom-label']);
      expect(skill).toBe('pptx');
    });

    it('should allow adding custom category mappings', async () => {
      detector.addCategoryMapping('custom-category', 'email');
      const skill = detector.detectSkillFromCategory('custom-category');
      expect(skill).toBe('email');
    });
  });
});