
import { describe, it, expect } from 'vitest';
import { isEventAllowedForCouple } from '../lib/enrollment-utils';

describe('isEventAllowedForCouple', () => {
    const classCCouple = {
        class: 'C',
        disciplines: ['latino', 'standard'],
        category: 'Adult',
        discipline_info: {
            latino: 'C',
            standard: 'C'
        }
    };

    it('should allow Class C couple to see Open C events', () => {
        const event = {
            event_name: 'Gara Open C',
            allowed_classes: ['C'],
            min_age: 19,
            max_age: 34
        };
        expect(isEventAllowedForCouple(event, classCCouple)).toBe(true);
    });

    it('should allow Class C couple to see Open B events', () => {
        const event = {
            event_name: 'Gara Open B',
            allowed_classes: ['B1', 'B2', 'B3'],
            min_age: 19,
            max_age: 34
        };
        expect(isEventAllowedForCouple(event, classCCouple)).toBe(true);
    });

    it('should NOT allow Class C couple to see Classe A events even if they have "c" in the name', () => {
        const event = {
            event_name: 'Gara Open Nazionale - Classe A',
            allowed_classes: ['A'],
            min_age: 19,
            max_age: 34
        };
        expect(isEventAllowedForCouple(event, classCCouple)).toBe(false);
    });

    it('should NOT allow Class C couple to see Adult Open events', () => {
        const event = {
            event_name: 'Adult Open',
            allowed_classes: ['A', 'A1', 'A2'],
            min_age: 19,
            max_age: 34
        };
        expect(isEventAllowedForCouple(event, classCCouple)).toBe(false);
    });

    it('should NOT allow Class C couple to see standard Classe A events', () => {
        const event = {
            event_name: 'Gara Classe A Standard',
            allowed_classes: ['A'],
            min_age: 19,
            max_age: 34
        };
        expect(isEventAllowedForCouple(event, classCCouple)).toBe(false);
    });

    it('should allow Class C couple if they specifically have A in discipline_info for that discipline', () => {
        const mixedCouple = {
            class: 'C',
            disciplines: ['latino', 'standard'],
            category: 'Adult',
            discipline_info: {
                latino: 'A', // For some reason they are A in latino
                standard: 'C'
            }
        };
        const event = {
            event_name: 'Gara Classe A Latino',
            allowed_classes: ['A'],
            min_age: 19,
            max_age: 34
        };
        expect(isEventAllowedForCouple(event, mixedCouple)).toBe(true);
    });
});
