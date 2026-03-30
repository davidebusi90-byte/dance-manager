
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

    it('should allow Youth Class D couple to see Youth Open events', () => {
        const youthDCouple = {
            class: 'D',
            disciplines: ['latino'],
            category: 'Youth',
            athlete1: { birth_date: '2008-01-01' }, // 18 in 2026
            athlete2: { birth_date: '2009-01-01' }  // 17 in 2026
        };
        const event = {
            event_name: 'Youth Open Latino',
            allowed_classes: ['AS', 'A', 'B1'],
            min_age: 16,
            max_age: 18
        };
        expect(isEventAllowedForCouple(event, youthDCouple)).toBe(true);
    });

    describe('AS Class restrictions', () => {
        const asSeniorCouple = {
            class: 'AS',
            disciplines: ['standard'],
            category: 'Senior 3a',
            discipline_info: { standard: 'AS' },
            athlete1: { birth_date: '1968-01-01' }, // 58 in 2026
            athlete2: { birth_date: '1969-01-01' }  // 57 in 2026
        };

        it('should allow AS Senior couple to see Open events', () => {
            const event = {
                event_name: 'Senior 3 Open Standard',
                allowed_classes: ['AS', 'A'],
                min_age: 55,
                max_age: 60
            };
            expect(isEventAllowedForCouple(event, asSeniorCouple)).toBe(true);
        });

        it('should NOT allow AS Senior couple to see non-Open events even if class AS is allowed', () => {
            const event = {
                event_name: 'Campionato Regionale Standard',
                allowed_classes: ['AS'],
                min_age: 55,
                max_age: 60
            };
            // nameFormattedNorm will be "campionato regionale standard - as" (does not contain "open")
            expect(isEventAllowedForCouple(event, asSeniorCouple)).toBe(false);
        });

        it('should allow AS Adult couple to see Adult Open events', () => {
            const asAdultCouple = {
                class: 'AS',
                disciplines: ['latino'],
                category: 'Adult',
                discipline_info: { latino: 'AS' }
            };
            const event = {
                event_name: 'Adult Open Latino',
                allowed_classes: ['AS', 'A1'],
                min_age: 19,
                max_age: 34
            };
            expect(isEventAllowedForCouple(event, asAdultCouple)).toBe(true);
        });

        it('should NOT allow AS Adult couple to see non-Open Adult events', () => {
            const asAdultCouple = {
                class: 'AS',
                disciplines: ['latino'],
                category: 'Adult',
                discipline_info: { latino: 'AS' }
            };
            const event = {
                event_name: 'Gara Classe AS Latino',
                allowed_classes: ['AS'],
                min_age: 19,
                max_age: 34
            };
            expect(isEventAllowedForCouple(event, asAdultCouple)).toBe(false);
        });
    });

    describe('Over 35/45/55 Age Restrictions', () => {
        const senior1Couple = {
            class: 'B1',
            disciplines: ['standard'],
            category: 'Senior 1',
            athlete1: { birth_date: '1985-01-01' }, // 41 in 2026
            athlete2: { birth_date: '1986-01-01' }  // 40 in 2026
        };

        const senior2Couple = {
            class: 'B1',
            disciplines: ['standard'],
            category: 'Senior 2',
            athlete1: { birth_date: '1975-01-01' }, // 51 in 2026
            athlete2: { birth_date: '1976-01-01' }  // 50 in 2026
        };

        const senior3Couple = {
            class: 'B1',
            disciplines: ['standard'],
            category: 'Senior 3a',
            athlete1: { birth_date: '1968-01-01' }, // 58 in 2026
            athlete2: { birth_date: '1969-01-01' }  // 57 in 2026
        };

        it('should allow Senior 1 to see Over 35', () => {
            const event = { event_name: 'Over 35 Open Standard', allowed_classes: ['B1'], min_age: 35, max_age: null };
            expect(isEventAllowedForCouple(event, senior1Couple)).toBe(true);
        });

        it('should allow Senior 2 to see Over 35', () => {
            const event = { event_name: 'Over 35 Open Standard', allowed_classes: ['B1'], min_age: 35, max_age: null };
            expect(isEventAllowedForCouple(event, senior2Couple)).toBe(true);
        });

        it('should NOT allow Senior 3 to see Over 35 (because eligible for Over 55)', () => {
            const event = { event_name: 'Over 35 Open Standard', allowed_classes: ['B1'], min_age: 35, max_age: null };
            expect(isEventAllowedForCouple(event, senior3Couple)).toBe(false);
        });

        it('should allow Senior 3 to see Over 45', () => {
            const event = { event_name: 'Over 45 Open Standard', allowed_classes: ['B1'], min_age: 45, max_age: null };
            expect(isEventAllowedForCouple(event, senior3Couple)).toBe(true);
        });

        it('should allow Senior 3 to see Over 55', () => {
            const event = { event_name: 'Over 55 Open Standard', allowed_classes: ['B1'], min_age: 55, max_age: null };
            expect(isEventAllowedForCouple(event, senior3Couple)).toBe(true);
        });
    });

    describe('Juvenile Age Restrictions', () => {
        it('should NOT allow Juvenile 2 (10-11) to see Juvenile 1 (6-9) events', () => {
            const juvenile2Couple = {
                class: 'D',
                disciplines: ['latino'],
                category: 'Juvenile 2', // 10-11
                athlete1: { birth_date: '2015-01-01' }, // 11 in 2026
                athlete2: { birth_date: '2016-01-01' }  // 10 in 2026
            };
            const event = {
                event_name: 'Juvenile 1 (6/9) Latino',
                allowed_classes: ['D'],
                min_age: 6,
                max_age: 9
            };
            expect(isEventAllowedForCouple(event, juvenile2Couple)).toBe(false);
        });

        it('should allow Juvenile 2 (10-11) to see Juvenile 2 (10-11) events', () => {
            const juvenile2Couple = {
                class: 'D',
                disciplines: ['latino'],
                category: 'Juvenile 2',
                athlete1: { birth_date: '2015-01-01' },
                athlete2: { birth_date: '2016-01-01' }
            };
            const event = {
                event_name: 'Juvenile 2 (10/11) Latino',
                allowed_classes: ['D'],
                min_age: 10,
                max_age: 11
            };
            expect(isEventAllowedForCouple(event, juvenile2Couple)).toBe(true);
        });

        it('should handle missing min_age/max_age in DB using fallback from name', () => {
            const juvenile2Couple = {
                class: 'D',
                disciplines: ['latino'],
                category: 'juvenile2',
                athlete1: { birth_date: '2015-01-01' },
                athlete2: { birth_date: '2016-01-01' }
            };
            const event = {
                event_name: 'Juvenile 1 (6/9) Latino',
                allowed_classes: ['D'],
                min_age: null, // Test fallback
                max_age: null
            };
            expect(isEventAllowedForCouple(event, juvenile2Couple)).toBe(false);
        });

        it('should NOT allow Juvenile Open B/C bypass if age is incorrect', () => {
            const juvenile2Couple = {
                class: 'D',
                disciplines: ['latino'],
                category: 'Juvenile 2',
                athlete1: { birth_date: '2015-01-01' },
                athlete2: { birth_date: '2016-01-01' }
            };
            const event = {
                event_name: 'Juvenile 1 (6/9) Open B Latino',
                allowed_classes: ['B1', 'B2', 'B3'],
                min_age: 6,
                max_age: 9
            };
            // Previous logic would return true because of "Open B" bypass
            // New logic should return false because age check is first
            expect(isEventAllowedForCouple(event, juvenile2Couple)).toBe(false);
        });
    });
});
