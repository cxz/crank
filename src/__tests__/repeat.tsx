/* @jsx createElement */
import "core-js";
import "mutationobserver-shim";
import {createElement, Controller, Element, render, RootView} from "../repeat";

describe("render", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	test("simple", () => {
		render(
			<div>
				<h1>Hello world</h1>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h1>Hello world</h1></div>");
	});

	test("rerender text", () => {
		const observer = new MutationObserver(() => {});
		observer.observe(document.body, {
			childList: true,
			attributes: true,
			characterData: true,
			subtree: true,
		});
		render(
			<div>
				<h1>Hello world</h1>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h1>Hello world</h1></div>");
		const records1 = observer.takeRecords();
		expect(records1.length).toEqual(1);
		render(
			<div>
				<h1>Hi world</h1>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h1>Hi world</h1></div>");
		const records2 = observer.takeRecords();
		expect(records2.length).toEqual(1);
		const [record2] = records2;
		expect(record2.type).toEqual("characterData");
		expect(record2.oldValue).toEqual("Hello world");
		// TODO: normalize adjacent text values
		render(
			<div>
				<h1>Hello {3}</h1>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h1>Hello 3</h1></div>");
		const records3 = observer.takeRecords();
		expect(records3.length).toEqual(1);
		const [record3] = records3;
		expect(record3.type).toEqual("characterData");
		expect(record3.oldValue).toEqual("Hi world");

		observer.disconnect();
	});

	test("rerender intrinsic", () => {
		const observer = new MutationObserver(() => {});
		observer.observe(document.body, {
			childList: true,
			attributes: true,
			characterData: true,
			subtree: true,
		});
		render(
			<div>
				<h1>Hello world</h1>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h1>Hello world</h1></div>");
		const records1 = observer.takeRecords();
		expect(records1.length).toEqual(1);
		render(
			<div>
				<h2>Hello world</h2>
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><h2>Hello world</h2></div>");
		const records2 = observer.takeRecords();
		expect(records2.length).toEqual(2);
		const [added, removed] = records2;
		expect(added.type).toEqual("childList");
		expect(added.addedNodes.length).toEqual(1);
		expect(removed.type).toEqual("childList");
		expect(removed.removedNodes.length).toEqual(1);
		observer.disconnect();
	});
});

describe("sync function component", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	test("basic", () => {
		function SyncFn({message}: {message: string}): Element {
			return <span>{message}</span>;
		}

		render(
			<div>
				<SyncFn message="Hello" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello</span></div>");
		render(
			<div>
				<SyncFn message="Goodbye" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Goodbye</span></div>");
	});
});

describe("async function component", () => {
	async function AsyncFn({
		message,
		time = 100,
	}: {
		message: string;
		time?: number;
	}): Promise<Element> {
		await new Promise((resolve) => setTimeout(resolve, time));
		return <span>{message}</span>;
	}

	const resolves: ((elem: Element) => void)[] = [];
	function ResolveFn(): Promise<Element> {
		return new Promise((resolve) => resolves.push(resolve));
	}

	afterEach(() => {
		document.body.innerHTML = "";
		resolves.length = 0;
	});

	test("basic", async () => {
		const viewP = render(
			<div>
				<AsyncFn message="Hello" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await expect(viewP).resolves.toBeInstanceOf(RootView);
		expect(document.body.innerHTML).toEqual("<div><span>Hello</span></div>");
	});

	test("rerender", async () => {
		render(
			<div>
				<ResolveFn />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		resolves[0](<span>Hello 0</span>);
		expect(document.body.innerHTML).toEqual("");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 0</span></div>");
		render(
			<div>
				<ResolveFn />
			</div>,
			document.body,
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		resolves[1](<span>Hello 1</span>);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 0</span></div>");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		expect(resolves.length).toEqual(2);
	});

	test.skip("race-condition", async () => {
		render(
			<div>
				<ResolveFn />
			</div>,
			document.body,
		);
		render(
			<div>
				<ResolveFn />
			</div>,
			document.body,
		);
		render(
			<div>
				<ResolveFn />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("");
		await new Promise((resolve) => setTimeout(resolve, 0));
		resolves[1](<span>Hello 1</span>);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		resolves[2](<span>Hello 2</span>);
		await new Promise((resolve) => setTimeout(resolve, 0));
		resolves[0](<span>Hello 0</span>);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
	});
});

describe("sync generator component", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	test("basic", () => {
		const SyncGen = jest.fn(function*(
			this: Controller,
			{message}: {message: string},
		): Generator<Element> {
			let i = 0;
			for ({message} of this) {
				i++;
				if (i > 2) {
					return;
				}

				yield <span>{message}</span>;
			}
		});

		render(
			<div>
				<SyncGen message="Hello 1" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		render(
			<div>
				<SyncGen message="Hello 2" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
		render(
			<div>
				<SyncGen message="Hello 3" />
			</div>,
			document.body,
		);
		expect(document.body.innerHTML).toEqual("<div></div>");
		expect(SyncGen).toHaveBeenCalledTimes(1);
	});

	test("update", () => {
		let update: () => void;
		function* SyncGen(this: Controller): Generator<Element> {
			let i = 1;
			update = this.update.bind(this);
			for (const _ of this) {
				yield <span>Hello {i++}</span>;
			}
		}

		render(
			<div>
				<SyncGen />
			</div>,
			document.body,
		);

		expect(document.body.innerHTML).toEqual("<div><span>Hello 1</span></div>");
		update!();
		expect(document.body.innerHTML).toEqual("<div><span>Hello 2</span></div>");
		update!();
		update!();
		expect(document.body.innerHTML).toEqual("<div><span>Hello 4</span></div>");
	});
});
