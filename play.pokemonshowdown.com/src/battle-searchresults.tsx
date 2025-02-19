/**
 * Search Results
 *
 * Code for displaying sesrch results from battle-dex-search.ts
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license AGPLv3
 */

import preact from "../js/lib/preact";
import {Dex, type ID} from "./battle-dex";
import type {DexSearch, SearchRow} from "./battle-dex-search";

export class PSSearchResults extends preact.Component<{search: DexSearch}> {
	readonly URL_ROOT = `//${Config.routes.dex}/`;

	renderPokemonSortRow() {
		const search = this.props.search;
		const sortCol = search.sortCol;
		return <li class="result"><div class="sortrow">
			<button class={`sortcol numsortcol${!sortCol ? ' cur' : ''}`}>{!sortCol ? 'Sort: ' : search.firstPokemonColumn}</button>
			<button class={`sortcol pnamesortcol${sortCol === 'name' ? ' cur' : ''}`} data-sort="name">Name</button>
			<button class={`sortcol typesortcol${sortCol === 'type' ? ' cur' : ''}`} data-sort="type">Types</button>
			<button class={`sortcol abilitysortcol${sortCol === 'ability' ? ' cur' : ''}`} data-sort="ability">Abilities</button>
			<button class={`sortcol statsortcol${sortCol === 'hp' ? ' cur' : ''}`} data-sort="hp">HP</button>
			<button class={`sortcol statsortcol${sortCol === 'atk' ? ' cur' : ''}`} data-sort="atk">Atk</button>
			<button class={`sortcol statsortcol${sortCol === 'def' ? ' cur' : ''}`} data-sort="def">Def</button>
			<button class={`sortcol statsortcol${sortCol === 'spa' ? ' cur' : ''}`} data-sort="spa">SpA</button>
			<button class={`sortcol statsortcol${sortCol === 'spd' ? ' cur' : ''}`} data-sort="spd">SpD</button>
			<button class={`sortcol statsortcol${sortCol === 'spe' ? ' cur' : ''}`} data-sort="spe">Spe</button>
			<button class={`sortcol statsortcol${sortCol === 'bst' ? ' cur' : ''}`} data-sort="bst">BST</button>
		</div></li>;
	}

	renderMoveSortRow() {
		const sortCol = this.props.search.sortCol;
		return <li class="result"><div class="sortrow">
			<button class={`sortcol movenamesortcol${sortCol === 'name' ? ' cur' : ''}`} data-sort="name">Name</button>
			<button class={`sortcol movetypesortcol${sortCol === 'type' ? ' cur' : ''}`} data-sort="type">Type</button>
			<button class={`sortcol movetypesortcol${sortCol === 'category' ? ' cur' : ''}`} data-sort="category">Cat</button>
			<button class={`sortcol powersortcol${sortCol === 'power' ? ' cur' : ''}`} data-sort="power">Pow</button>
			<button class={`sortcol accuracysortcol${sortCol === 'accuracy' ? ' cur' : ''}`} data-sort="accuracy">Acc</button>
			<button class={`sortcol ppsortcol${sortCol === 'pp' ? ' cur' : ''}`} data-sort="pp">PP</button>
		</div></li>;
	}

	renderPokemonRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const pokemon = search.dex.species.get(id);
		if (!pokemon) return <li class="result">Unrecognized pokemon</li>;

		let tagStart = (pokemon.forme ? pokemon.name.length - pokemon.forme.length - 1 : 0);

		const stats = pokemon.baseStats;
		let bst = 0;
		for (const stat of Object.values(stats)) bst += stat;
		if (search.dex.gen < 2) bst -= stats['spd'];

		if (errorMessage) {
			return <li class="result"><a href={`${this.URL_ROOT}pokemon/${id}`} data-target="push" data-entry={`pokemon|${pokemon.name}`}>
				<span class="col numcol">{search.getTier(pokemon)}</span>

				<span class="col iconcol">
					<span style={Dex.getPokemonIcon(pokemon.id)}></span>
				</span>

				<span class="col pokemonnamecol">{this.renderName(pokemon.name, matchStart, matchEnd, tagStart)}</span>

				{errorMessage}
			</a></li>;
		}

		return <li class="result"><a href={`${this.URL_ROOT}pokemon/${id}`} data-target="push" data-entry={`pokemon|${pokemon.name}`}>
			<span class="col numcol">{search.getTier(pokemon)}</span>

			<span class="col iconcol">
				<span style={Dex.getPokemonIcon(pokemon.id)}></span>
			</span>

			<span class="col pokemonnamecol">{this.renderName(pokemon.name, matchStart, matchEnd, tagStart)}</span>

			<span class="col typecol">
				{pokemon.types.map(type =>
					<img src={`${Dex.resourcePrefix}sprites/types/${type}.png`} alt={type} height="14" width="32" class="pixelated" />
				)}
			</span>

			{search.dex.gen >= 3 && (pokemon.abilities['1'] ?
				<span class="col twoabilitycol">{pokemon.abilities['0']}<br />{pokemon.abilities['1']}</span>
			:
				<span class="col abilitycol">{pokemon.abilities['0']}</span>
			)}
			{search.dex.gen >= 5 && (pokemon.abilities['S'] ?
				<span class={`col twoabilitycol${pokemon.unreleasedHidden ? ' unreleasedhacol' : ''}`}>{pokemon.abilities['H'] || ''}<br />{pokemon.abilities['S']}</span>
			: pokemon.abilities['H'] ?
				<span class={`col abilitycol${pokemon.unreleasedHidden ? ' unreleasedhacol' : ''}`}>{pokemon.abilities['H']}</span>
			:
				<span class="col abilitycol"></span>
			)}

			<span class="col statcol"><em>HP</em><br />{stats.hp}</span>
			<span class="col statcol"><em>Atk</em><br />{stats.atk}</span>
			<span class="col statcol"><em>Def</em><br />{stats.def}</span>
			{search.dex.gen > 2 && <span class="col statcol"><em>SpA</em><br />{stats.spa}</span>}
			{search.dex.gen > 2 && <span class="col statcol"><em>SpD</em><br />{stats.spd}</span>}
			{search.dex.gen < 2 && <span class="col statcol"><em>Spc</em><br />{stats.spa}</span>}
			<span class="col statcol"><em>Spe</em><br />{stats.spe}</span>
			<span class="col bstcol"><em>BST<br />{bst}</em></span>
		</a></li>;
	}

	renderName(name: string, matchStart: number, matchEnd: number, tagStart?: number) {
		if (!matchEnd) {
			if (!tagStart) return name;
			return [
				name.slice(0, tagStart), <small>{name.slice(tagStart)}</small>,
			];
		}

		let output: preact.ComponentChild[];
		if (tagStart && matchStart >= tagStart) {
			output = [name];
		} else {
			output = [
				name.slice(0, matchStart),
				<b>{name.slice(matchStart, matchEnd)}</b>,
				name.slice(matchEnd, tagStart || name.length),
			];
			if (!tagStart) return output;
		}

		if (matchEnd && matchEnd > tagStart) {
			if (matchStart < tagStart) {
				matchStart = tagStart;
			}
			output.push(
				<small>{name.slice(tagStart, matchStart)}<b>{name.slice(matchStart, matchEnd)}</b>{name.slice(matchEnd)}</small>
			);
		} else {
			output.push(<small>{name.slice(tagStart)}</small>);
		}

		return output;
	}

	renderItemRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const item = search.dex.items.get(id);
		if (!item) return <li class="result">Unrecognized item</li>;

		return <li class="result"><a href={`${this.URL_ROOT}items/${id}`} data-target="push" data-entry={`item|${item.name}`}>
			<span class="col itemiconcol">
				<span style={Dex.getItemIcon(item)}></span>
			</span>

			<span class="col namecol">{this.renderName(item.name, matchStart, matchEnd)}</span>

			{errorMessage}

			{!errorMessage && <span class="col itemdesccol">{item.shortDesc}</span>}
		</a></li>;
	}

	renderAbilityRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const ability = search.dex.abilities.get(id);
		if (!ability) return <li class="result">Unrecognized ability</li>;

		return <li class="result"><a href={`${this.URL_ROOT}abilitys/${id}`} data-target="push" data-entry={`ability|${ability.name}`}>
			<span class="col namecol">{this.renderName(ability.name, matchStart, matchEnd)}</span>

			{errorMessage}

			{!errorMessage && <span class="col abilitydesccol">{ability.shortDesc}</span>}
		</a></li>;
	}

	renderMoveRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const move = search.dex.moves.get(id);
		if (!move) return <li class="result">Unrecognized move</li>;

		const tagStart = (move.name.startsWith('Hidden Power') ? 12 : 0);

		if (errorMessage) {
			return <li class="result"><a href={`${this.URL_ROOT}move/${id}`} data-target="push" data-entry={`move|${move.name}`}>
				<span class="col movenamecol">{this.renderName(move.name, matchStart, matchEnd, tagStart)}</span>

				{errorMessage}
			</a></li>;
		}

		let pp = (move.pp === 1 || move.noPPBoosts ? move.pp : move.pp * 8 / 5);
		if (search.dex.gen < 3) pp = Math.min(61, pp);
		return <li class="result"><a href={`${this.URL_ROOT}move/${id}`} data-target="push" data-entry={`move|${move.name}`}>
			<span class="col movenamecol">{this.renderName(move.name, matchStart, matchEnd, tagStart)}</span>

			<span class="col typecol">
				<img src={`${Dex.resourcePrefix}sprites/types/${move.type}.png`} alt={move.type} height="14" width="32" class="pixelated" />
				<img src={`${Dex.resourcePrefix}sprites/categories/${move.category}.png`} alt={move.category} height="14" width="32" class="pixelated" />
			</span>

			<span class="col labelcol">
				{move.category !== 'Status' ? [<em>Power</em>, <br />, `${move.basePower}` || '\u2014'] : ''}
			</span>
			<span class="col widelabelcol">
				<em>Accuracy</em><br />{move.accuracy && move.accuracy !== true ? `${move.accuracy}%` : '\u2014'}
			</span>
			<span class="col pplabelcol">
				<em>PP</em><br />{pp}
			</span>

			<span class="col movedesccol">{move.shortDesc}</span>

		</a></li>;
	}

	renderTypeRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const name = id.charAt(0).toUpperCase() + id.slice(1);

		return <li class="result"><a href={`${this.URL_ROOT}types/${id}`} data-target="push" data-entry={`type|${name}`}>
			<span class="col namecol">{this.renderName(name, matchStart, matchEnd)}</span>

			<span class="col typecol">
				<img src={`${Dex.resourcePrefix}sprites/types/${name}.png`} alt={name} height="14" width="32" class="pixelated" />
			</span>

			{errorMessage}
		</a></li>;
	}

	renderCategoryRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const name = id.charAt(0).toUpperCase() + id.slice(1);

		return <li class="result"><a href={`${this.URL_ROOT}categories/${id}`} data-target="push" data-entry={`category|${name}`}>
			<span class="col namecol">{this.renderName(name, matchStart, matchEnd)}</span>

			<span class="col typecol">
				<img src={`${Dex.resourcePrefix}sprites/categories/${name}.png`} alt={name} height="14" width="32" class="pixelated" />
			</span>

			{errorMessage}
		</a></li>;
	}

	renderArticleRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		const isSearchType = (id === 'pokemon' || id === 'moves');
		const name = (window.BattleArticleTitles && window.BattleArticleTitles[id]) ||
			(id.charAt(0).toUpperCase() + id.substr(1));

		return <li class="result"><a href={`${this.URL_ROOT}articles/${id}`} data-target="push" data-entry={`article|${name}`}>
			<span class="col namecol">{this.renderName(name, matchStart, matchEnd)}</span>

			<span class="col movedesccol">{isSearchType ? "(search type)" : "(article)"}</span>

			{errorMessage}
		</a></li>;
	}

	renderEggGroupRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		// very hardcode
		let name: string | undefined;
		if (id === 'humanlike') name = 'Human-Like';
		else if (id === 'water1') name = 'Water 1';
		else if (id === 'water2') name = 'Water 2';
		else if (id === 'water3') name = 'Water 3';
		if (name) {
			if (matchEnd > 5) matchEnd++;
		} else {
			name = id.charAt(0).toUpperCase() + id.slice(1);
		}

		return <li class="result"><a href={`${this.URL_ROOT}egggroups/${id}`} data-target="push" data-entry={`egggroup|${name}`}>
			<span class="col namecol">{this.renderName(name, matchStart, matchEnd)}</span>

			<span class="col movedesccol">(egg group)</span>

			{errorMessage}
		</a></li>;
	}

	renderTierRow(id: ID, matchStart: number, matchEnd: number, errorMessage?: preact.ComponentChildren) {
		const search = this.props.search;
		// very hardcode
		const tierTable: {[id: string]: string} = {
			uber: "Uber",
			caplc: "CAP LC",
			capnfe: "CAP NFE",
		};
		const name = tierTable[id] || id.toUpperCase();

		return <li class="result"><a href={`${this.URL_ROOT}tiers/${id}`} data-target="push" data-entry={`tier|${name}`}>
			<span class="col namecol">{this.renderName(name, matchStart, matchEnd)}</span>

			<span class="col movedesccol">(tier)</span>

			{errorMessage}
		</a></li>;
	}

	renderRow(row: SearchRow) {
		const search = this.props.search;
		const [type, id] = row;
		let matchStart = 0;
		let matchEnd = 0;
		if (row.length > 3) {
			matchStart = row[2]!;
			matchEnd = row[3]!;
		}

		let errorMessage: preact.ComponentChild = null;
		let label;
		if ((label = search.filterLabel(type))) { // tslint:disable-line
			errorMessage = <span class="col filtercol"><em>{label}</em></span>;
		} else if ((label = search.illegalLabel(id as ID))) { // tslint:disable-line
			errorMessage = <span class="col illegalcol"><em>{label}</em></span>;
		}

		switch (type) {
		case 'html':
			const sanitizedHTML = id.replace(/</g, '&lt;')
				.replace(/&lt;em>/g, '<em>').replace(/&lt;\/em>/g, '</em>')
				.replace(/&lt;strong>/g, '<strong>').replace(/&lt;\/strong>/g, '</strong>');
			return <li class="result">
				<p dangerouslySetInnerHTML={{__html: sanitizedHTML}}></p>
			</li>;
		case 'header':
			return <li class="result"><h3>{id}</h3></li>;
		case 'sortpokemon':
			return this.renderPokemonSortRow();
		case 'sortmove':
			return this.renderMoveSortRow();
		case 'pokemon':
			return this.renderPokemonRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'move':
			return this.renderMoveRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'item':
			return this.renderItemRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'ability':
			return this.renderAbilityRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'type':
			return this.renderTypeRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'egggroup':
			return this.renderEggGroupRow(id as ID, matchStart, matchEnd, errorMessage);
			case 'tier':
			return this.renderTierRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'category':
			return this.renderCategoryRow(id as ID, matchStart, matchEnd, errorMessage);
		case 'article':
			return this.renderArticleRow(id as ID, matchStart, matchEnd, errorMessage);
		}
		return <li>Error: not found</li>;
	}

	render() {
		const search = this.props.search;
		return <ul class="dexlist">
			{search.filters && <p>
				Filters: {}
				{search.filters.map(([type, name]) =>
					<button class="filter" value={`${type}:${name}`}>
						${name} <i class="fa fa-times-circle"></i>
					</button>
				)}
				{!search.query && <small style="color: #888">(backspace = delete filter)</small>}
			</p>}
			{search.results &&
			// TODO: implement windowing
			// for now, just show first twenty results
			search.results.slice(0, 20).map(result =>
				this.renderRow(result)
			)}
		</ul>;
	}
}
