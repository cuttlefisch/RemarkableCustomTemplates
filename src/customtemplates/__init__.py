import json
import importlib.resources
import os.path
from pprint import pprint
from typing import List, OrderedDict, Union
from collections import OrderedDict

from setuptools.discovery import construct_package_dir
from pudb import set_trace

SRCDIR = importlib.resources.files("customtemplates")


class RemarkableTemplate:
    src_template = {}
    output_file: str = "debug.template"
    name = ""
    author = ""
    templateVersion = ""
    formatVersion = ""
    categories = []
    orientation = ""
    constants = []
    src_items = []
    items = []
    res: OrderedDict = OrderedDict()

    def __init__(self, filepath, output_file: "debug.template"):
        with open(f"{filepath}", "r") as json_src:
            self.src_template = json.load(json_src, object_pairs_hook=OrderedDict)
        self.name = "DEBUG TEMPLATE"  # self.src_template["name"]
        self.author = self.src_template["author"]
        self.templateVersion = self.src_template["templateVersion"]
        self.formatVersion = self.src_template["formatVersion"]
        self.categories = self.src_template["categories"]
        self.categories.append("DEBUG")
        self.orientation = self.src_template["orientation"]
        self.constants = self.src_template["constants"]
        self.src_items = self.src_template["items"]
        self.output_file = output_file
        self.populate_children()
        self.construct_output_dict()

    def populate_children(self):
        """Construct child object for each Item in items"""
        for item in self.src_items:
            if item["type"] == "text":
                self.items.append(RemarkableText(kwargs=item))
            elif item["type"] == "group":
                self.items.append(RemarkableGroup(kwargs=item))
            elif item["type"] == "path":
                self.items.append(RemarkablePath(kwargs=item))
            else:
                raise ValueError(f"ERROR: Invalid Item type in children:\t{type(item)}")

    def construct_output_dict(self):
        self.res = OrderedDict()
        self.res["name"] = self.name
        self.res["author"] = self.author
        self.res["templateVersion"] = self.templateVersion
        self.res["formatVersion"] = self.formatVersion
        self.res["categories"] = self.categories
        self.res["orientation"] = self.orientation
        self.res["constants"] = self.constants
        _items = []
        for item in self.items:
            _items.append(item.res)
        self.res["items"] = _items

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        return json.dumps(self.res)

    def write_json_template(self):
        """Combine all children JSON and self json into output file."""
        abs_output_file_path = os.path.join(SRCDIR, "output", self.output_file)
        self.construct_output_dict()
        with open(f"{abs_output_file_path}", "w+") as output_stream:
            json.dump(self.res, output_stream)


class RemarkableText:
    _id: str = ""
    _type: str = "text"
    text: str = ""
    fontSize: int = 8
    position: dict = {"x": 0, "y": 0}
    res: OrderedDict = OrderedDict()

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = f"TEXT--{self.__hash__()}"
        else:
            self._id = kwargs["id"]
        if not "text" in kwargs.keys():
            self.text = "penis"
        else:
            self.text = kwargs["text"]
        self.position = kwargs["position"]
        self.fontsize = kwargs["fontSize"]
        print(f"ID::\t {self._id}")
        self.construct_output_dict()

    def construct_output_dict(self):
        """Return ordered dict of class attrs to values."""
        self.res = OrderedDict()
        self.res["id"] = self._id
        self.res["type"] = self._type
        self.res["text"] = self.text
        self.res["fontSize"] = self.fontSize
        self.res["position"] = self.position

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        pprint(self.res)
        return json.dumps(self.res)


class RemarkablePath:
    _id = ""
    _type: str = "path"
    fillColor = "#ffffff"
    strokeColor = "#000000"
    strokeWidth = 0
    antialiasing: str = "true"
    data = []
    res: OrderedDict = OrderedDict()

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = f"PATH--{self.__hash__()}"
        else:
            self._id = kwargs["id"]
        # set_trace()
        self.data = kwargs["data"]
        if not "fillCollor" in kwargs.keys():
            self.fillColor = "#ffffff"
        else:
            self.fillColor = kwargs["fillColor"]
        if not "strokeColor" in kwargs.keys():
            self.strokeColor = "#000000"
        else:
            self.strokeColor = kwargs["strokeColor"]
        if not "strokeWidth" in kwargs.keys():
            self.strokeWidth = 1
        else:
            self.strokeWidth = kwargs["strokeWidth"]
        if not "antialiasing" in kwargs.keys():
            self.antialiasing = "true"
        else:
            self.antialiasing = kwargs["antialiasing"]
        print(f"ID::\t {self._id}")
        self.construct_output_dict()

    def construct_output_dict(self):
        """Return ordered dict of class attrs to values."""
        self.res = OrderedDict()
        self.res["id"] = self._id
        self.res["type"] = self._type
        self.res["fillColor"] = self.fillColor
        self.res["strokeColor"] = self.strokeColor
        self.res["strokeWidth"] = self.strokeWidth
        self.res["antialiasing"] = self.antialiasing
        self.res["data"] = self.data

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        return json.dumps(self.res)


class RemarkableGroup:
    _id = ""
    _type = "group"
    boundingBox = {"x": 0, "y": 0, "width": 0, "height": 0}
    repeat = {"rows": 0, "columns": 0}
    src_children = []
    children: List[Union["RemarkableGroup", RemarkablePath, RemarkableText]] = []
    res: OrderedDict = OrderedDict()

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = f"GROUP--{self.__hash__()}"
        else:
            self._id = kwargs["id"]
        if not "repeat" in kwargs.keys():
            self.repeat = {"rows": 0, "columns": 0}
        else:
            self.repeat = kwargs["repeat"]
        print(f"ID::\t {self._id}")
        self.boundingBox = kwargs["boundingBox"]
        self.src_children = kwargs["children"]
        # pprint(self.src_children)
        self.populate_children()
        self.construct_output_dict()
        # self.construct_output_dict()

    def construct_output_dict(self):
        """Return ordered dict of class attrs to values."""
        self.res = OrderedDict()
        self.res["id"] = self._id
        self.res["type"] = self._type
        self.res["boundingBox"] = self.boundingBox
        self.res["repeat"] = self.repeat
        _children = []
        for child in self.children:
            _children.append(child.res)
        self.res["children"] = _children
        # self.res["children"] = self.children

    def populate_children(self):
        for item in self.src_children:
            print(f"ITEM-TYPE::\t{item['type']}")
            if item["type"] == "text":
                self.children.append(RemarkableText(kwargs=item))
            elif item["type"] == "group":
                self.children.append(RemarkableGroup(kwargs=item))
            elif item["type"] == "path":
                self.children.append(RemarkablePath(kwargs=item))
            else:
                raise ValueError(f"ERROR: Invalid Item type in children:\t{type(item)}")

    def json(self):
        """Return json object representing local remarkable template component."""
        self.construct_output_dict()
        return json.dumps(self.res)


def main():
    rmt = RemarkableTemplate(f"{SRCDIR}/data/P Week 2.template", "debug.template")
    print(rmt.json())
    rmt.write_json_template()


if __name__ == "__main__":
    main()
