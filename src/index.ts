import {
    cloneElement,
    createElement,
    Fragment,
    isValidElement,
    ReactNode,
} from 'react';

import { Token, tokenize } from './tokenize';

export interface Tags {
    componentOpen: [string, string];
    componentClose: [string, string];
    componentSelfClosing: [string, string];
}

const DEFAULT_TAGS: Tags = {
    componentOpen: ['{{', '}}'],
    componentClose: ['{{/', '}}'],
    componentSelfClosing: ['{{', '/}}'],
};

function getCloseIndex(openIndex: number, tokens: Token[]) {
    const openToken = tokens[openIndex];
    let nestLevel = 0;
    for (let i = openIndex + 1; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.value === openToken.value) {
            if (token.type === 'componentOpen') {
                nestLevel++;
                continue;
            }
            if (token.type === 'componentClose') {
                if (nestLevel === 0) {
                    return i;
                }
                nestLevel--;
            }
        }
    }
    // if we get this far, there was no matching close token
    throw new Error(`Missing closing component token \`${openToken.value}\``);
}

function buildNode(
    tokens: Token[],
    components: Record<string, ReactNode>,
): ReactNode {
    const children = gatherChildren(tokens, components).map((node, index) =>
        createElement(Fragment, { key: index }, node),
    );
    return createElement(Fragment, null, children);
}

function gatherChildren(
    tokens: Token[],
    components: Record<string, ReactNode>,
): ReactNode[] {
    let children: ReactNode[] = [];

    let componentOpen: [ReactNode, number] = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'string') {
            children.push(token.value);
            continue;
        }
        // component node should at least be set
        if (
            !components.hasOwnProperty(token.value) ||
            typeof components[token.value] === 'undefined'
        ) {
            throw new Error(
                `Invalid interpolation, missing component node: \`${token.value}\``,
            );
        }
        // we should never see a componentClose token in this loop
        if (token.type === 'componentClose') {
            throw new Error(
                'Missing opening component token: `' + token.value + '`',
            );
        }
        if (token.type === 'componentOpen') {
            componentOpen = [components[token.value], i];
            break;
        }
        // componentSelfClosing token
        children.push(components[token.value]);
    }

    if (componentOpen !== null) {
        const [openComponent, openIndex] = componentOpen;

        const closeIndex = getCloseIndex(openIndex, tokens);
        const grandChildTokens = tokens.slice(openIndex + 1, closeIndex);
        const grandChildren = buildNode(grandChildTokens, components);

        const clonedOpenComponent: ReactNode = isValidElement(openComponent)
            ? cloneElement(openComponent, null, grandChildren)
            : openComponent;
        children.push(clonedOpenComponent);

        if (closeIndex < tokens.length - 1) {
            const siblingTokens = tokens.slice(closeIndex + 1);
            const siblings = gatherChildren(siblingTokens, components);
            children = children.concat(siblings);
        }
    }

    return children;
}

interface InterpolateOptions {
    mixedString: string;
    components: Record<string, ReactNode>;
    tags?: Tags;
    throwErrors?: boolean;
}

export default function interpolate(options: InterpolateOptions): ReactNode {
    const {
        mixedString,
        components,
        tags = DEFAULT_TAGS,
        throwErrors = false,
    } = options;

    if (!components) {
        return mixedString;
    }

    if (typeof components !== 'object') {
        if (throwErrors) {
            throw new Error(
                `Interpolation Error: unable to process \`${mixedString}\` because components is not an object`,
            );
        }
        return mixedString;
    }

    if (
        typeof tags !== 'object' ||
        !tags.componentOpen ||
        !tags.componentClose ||
        !tags.componentSelfClosing
    ) {
        if (throwErrors) {
            throw new Error(
                `Interpolation Error: unable to process \`${mixedString}\` because tags is invalid`,
            );
        }
        return mixedString;
    }

    const tokens = tokenize(mixedString, tags);

    try {
        return buildNode(tokens, components);
    } catch (error) {
        if (throwErrors) {
            throw new Error(
                `Interpolation Error: unable to process \`${mixedString}\` because of error \`${error.message}\``,
            );
        }
        return mixedString;
    }
}
