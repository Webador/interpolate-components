import type { Tags } from './index';

type TagType = 'componentClose' | 'componentSelfClosing' | 'componentOpen';
const TAG_TYPES: TagType[] = [
    'componentClose',
    'componentSelfClosing',
    'componentOpen',
];

export interface Token {
    type: 'string' | TagType;
    value: string;
}

function identifyToken(item: string, regExps: Record<TagType, RegExp>): Token {
    for (let i = 0; i < TAG_TYPES.length; i++) {
        const type = TAG_TYPES[i];
        const match = item.match(regExps[type]);

        if (match) {
            return {
                type: type,
                value: match[1],
            };
        }
    }

    return {
        type: 'string',
        value: item,
    };
}

function escapeRegExp(str: string): string {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function makeRegExp(tag: [string, string], match: boolean) {
    const [start, end] = tag;
    const inner = match ? '\\s*(\\w+)\\s*' : '\\s*\\w+\\s*';
    return new RegExp(`${escapeRegExp(start)}${inner}${escapeRegExp(end)}`);
}

export function tokenize(mixedString: string, tags: Tags): Token[] {
    // create regular expression that matches all components
    const combinedRegExpString = TAG_TYPES.map((type) => tags[type])
        .map((tag) => makeRegExp(tag, false).source)
        .join('|');
    const combinedRegExp = new RegExp(`(${combinedRegExpString})`, 'g');

    // split to components and strings
    const tokenStrings = mixedString.split(combinedRegExp);

    // create regular expressions for identifying tokens
    const componentRegExps = {} as Record<TagType, RegExp>;
    TAG_TYPES.forEach((type) => {
        componentRegExps[type] = makeRegExp(tags[type], true);
    });

    return tokenStrings.map((tokenString) =>
        identifyToken(tokenString, componentRegExps),
    );
}
