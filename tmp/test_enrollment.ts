import { isEventAllowedForCouple } from '../src/lib/enrollment-utils';

const et = {
    event_name: "14/15 B Open Standard",
    allowed_classes: ["B"],
    min_age: 14,
    max_age: 15
};

const couple = {
    category: "14/15",
    class: "B3",
    disciplines: ["Standard"],
    athlete1: { birth_date: null },
    athlete2: { birth_date: null },
};

console.log(isEventAllowedForCouple(et, couple));
