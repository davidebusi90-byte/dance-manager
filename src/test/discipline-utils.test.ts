import { describe, it, expect } from 'vitest';
import { resolveDisciplineClass, normalizeClassDisplay } from '../lib/discipline-utils';

describe('normalizeClassDisplay', () => {
    it('should normalize B to B1', () => {
        expect(normalizeClassDisplay('B')).toBe('B1');
        expect(normalizeClassDisplay('b')).toBe('B1');
        expect(normalizeClassDisplay('  b  ')).toBe('B1');
    });

    it('should keep other classes as is', () => {
        expect(normalizeClassDisplay('B1')).toBe('B1');
        expect(normalizeClassDisplay('A2')).toBe('A2');
        expect(normalizeClassDisplay('D')).toBe('D');
        expect(normalizeClassDisplay('AS')).toBe('AS');
        expect(normalizeClassDisplay('MASTER')).toBe('MASTER');
    });

    it('should return - for empty or -', () => {
        expect(normalizeClassDisplay(null)).toBe('-');
        expect(normalizeClassDisplay(undefined)).toBe('-');
        expect(normalizeClassDisplay('-')).toBe('-');
        expect(normalizeClassDisplay('')).toBe('-');
    });
});

describe('resolveDisciplineClass', () => {
    const athlete1 = {
        id: '1',
        class: 'B1',
        discipline_info: {
            standard: 'B1',
            latino: 'A2'
        }
    } as any;

    const athlete2 = {
        id: '2',
        class: 'A2',
        discipline_info: {
            standard: 'A2',
            latino: 'B1'
        }
    } as any;

    const athleteA2 = {
        id: '3',
        class: 'A2',
        discipline_info: {
            combinata: 'A2'
        }
    } as any;

    const couple = {
        id: 'c1',
        class: 'B1',
        athlete1_id: '1',
        athlete2_id: '2',
        disciplines: ['standard', 'latino'],
        discipline_info: {
            standard: 'B1'
        }
    } as any;

    it('should resolve the best class among athletes and couple for a discipline', () => {
        // Standard: ath1(B1), ath2(A2), couple(B1) -> A2
        expect(resolveDisciplineClass('standard', athlete1, athlete2, couple)).toBe('A2');
        
        // Latino: ath1(A2), ath2(B1), couple(null) -> A2
        expect(resolveDisciplineClass('latino', athlete1, athlete2, couple)).toBe('A2');
    });

    it('should fallback to Combined best of Latin and Standard if missing', () => {
        // athlete1: lat(A2), std(B1) -> A2
        expect(resolveDisciplineClass('combinata', athlete1, null, null)).toBe('A2');
        
        // With both athletes: ath1(lat:A2, std:B1), ath2(lat:B1, std:A2) -> best of all is A2
        expect(resolveDisciplineClass('combinata', athlete1, athlete2, null)).toBe('A2');
    });

    it('should use explicit Combined class if present', () => {
        expect(resolveDisciplineClass('combinata', athleteA2, null, null)).toBe('A2');
    });

    it('should normalize B to B1 in resolution', () => {
        const athB = { discipline_info: { standard: 'B' } } as any;
        expect(resolveDisciplineClass('standard', athB, null, null)).toBe('B1');
    });

    it('should handle missing data gracefully', () => {
        expect(resolveDisciplineClass('standard', null, null, null)).toBe('-');
        expect(resolveDisciplineClass('combinata', null, null, null)).toBe('D');
    });

    it('should fallback to athlete general class if specific discipline info is missing', () => {
        const legacyAthlete = { id: 'leg', class: 'A2', discipline_info: {} } as any;
        // If Standard is NOT in couple.disciplines and NOT in athlete.discipline_info, it uses general class
        expect(resolveDisciplineClass('standard', legacyAthlete, null, null)).toBe('A2');
    });
});
