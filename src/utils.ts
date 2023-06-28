
// throws for bad obj 
export function allPropertyNames(obj: unknown): string[] {
    const props: string[] = [];
    do {
        props.push(...Object.getOwnPropertyNames(obj));
    } while (obj = Object.getPrototypeOf(obj));
    return props;
}

