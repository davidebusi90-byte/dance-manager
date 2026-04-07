
export interface Athlete {
    id: string;
    code: string;
    first_name: string;
    last_name: string;
    email: string | null;
    category: string;
    class: string;
    birth_date: string | null;
    medical_certificate_expiry: string | null;
    instructor_id: string | null;
    responsabili?: string[] | null;
    gender?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discipline_info?: any | null;
    is_deleted?: boolean;
    deleted_at?: string | null;
    qr_code?: string | null;
}

export interface Couple {
    id: string;
    category: string;
    class: string;
    disciplines: string[];
    athlete1_id: string;
    athlete2_id: string;
    discipline_info?: any | null;
    responsabili?: string[] | null;
    athlete1?: Athlete;
    athlete2?: Athlete;
    instructor_id?: string | null;
    is_active?: boolean;
}

export interface Competition {
    id: string;
    name: string;
    date: string;
    end_date: string | null;
    location: string | null;
    registration_deadline: string | null;
    late_fee_deadline: string | null;
    description: string | null;
    is_completed: boolean;
}

export interface Profile {
    id: string;
    user_id: string;
    full_name: string;
}
