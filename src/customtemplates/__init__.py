import json
import importlib.resources
from pprint import pprint
from typing import List, OrderedDict, Union
from collections import OrderedDict
from pudb import set_trace

SRCDIR = importlib.resources.files("customtemplates")


class RemarkableTemplate:
    src_template = {}
    name = ""
    author = ""
    templateVersion = ""
    formatVersion = ""
    categories = []
    orientation = ""
    cosntants = []
    items = []
    item_objs = []

    def __init__(self, filepath):
        with open(f"{filepath}", "r") as json_src:
            self.src_template = json.load(json_src)
        self.name = self.src_template["name"]
        self.author = self.src_template["author"]
        self.templateVersion = self.src_template["templateVersion"]
        self.formatVersion = self.src_template["formatVersion"]
        self.categories = self.src_template["categories"]
        self.orientation = self.src_template["orientation"]
        self.constants = self.src_template["constants"]
        self.items = self.src_template["items"]
        self.populate_children()

    def populate_children(self):
        """Construct child object for each Item in items"""
        for item in self.items:
            print(item["type"])
            if item["type"] == "text":
                self.item_objs.append(RemarkableText(kwargs=item))
            elif item["type"] == "group":
                self.item_objs.append(RemarkableGroup(kwargs=item))
            elif item["type"] == "path":
                self.item_objs.append(RemarkablePath(kwargs=item))
            else:
                raise ValueError(f"ERROR: Invalid Item type in children:\t{type(item)}")


class RemarkableText:
    _id: str = ""
    _type: str = "text"
    text: str = ""
    fontSize: int = 8
    position: dict = {"x": 0, "y": 0}

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = "000"
        else:
            self._id = kwargs["id"]
        if not "text" in kwargs.keys():
            self.text = "penis"
        else:
            self.text = kwargs["text"]
        self.position = kwargs["position"]
        self.fontsize = kwargs["fontSize"]

    def dict_repr(self):
        """Return ordered dict of class attrs to values."""
        res = {}
        res["id"] = self._id
        res["type"] = self._type
        res["text"] = self.text
        res["fontSize"] = self.fontSize
        res["positio"] = self.position


class RemarkablePath:
    _id = ""
    _type: str = "path"
    fillColor = "#ffffff"
    strokeColor = "#000000"
    strokeWidth = 0
    antialiasing: str = "true"
    data = []

    def __init__(self, *args, **kwargs):
        kwargs = kwargs["kwargs"]
        if not "id" in kwargs.keys():
            self._id = "000"
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

    def dict_repr(self):
        """Return ordered dict of class attrs to values."""
        res = {}
        res["id"] = self._id
        res["type"] = self._type
        res["fillColor"] = self.fillColor
        res["strokeColor"] = self.strokeColor
        res["strokeWidth"] = self.strokeWidth
        res["antialiasing"] = self.antialiasing
        res["data"] = self.data
        return res


class RemarkableGroup:
    _id = ""
    _type = "group"
    boundingBox = {"x": 0, "y": 0, "width": 0, "height": 0}
    repeat = {"rows": 0, "columns": 0}
    src_children = List[Union["RemarkableGroup", RemarkablePath, RemarkableText]]
    children_objs = []

    def __init__(self, *args, **kwargs):
        print(kwargs)
        if not "id" in kwargs.keys():
            self._id = "000"
        else:
            self._id = kwargs["kwarg"]["id"]
        if not "repeat" in kwargs.keys():
            self.repeat = {"rows": 0, "columns": 0}
        else:
            self.repeat = kwargs["kwargs"]["repeat"]
        self.boundingBox = kwargs["kwargs"]["boundingBox"]
        self.children = kwargs["kwargs"]["children"]
        self.populate_children()

    def dict_repr(self):
        """Return ordered dict of class attrs to values."""
        res = {}
        res["id"] = self._id
        res["type"] = self._type
        res["boundingBox"] = self.boundingBox
        res["repeat"] = self.repeat
        res["children"] = self.children

    def populate_children(self):
        for item in self.children:
            if item["type"] == "text":
                self.children_objs.append(RemarkableText(kwargs=item))
            elif item["type"] == "group":
                self.children_objs.append(RemarkableGroup(kwargs=item))
            elif item["type"] == "path":
                self.children_objs.append(RemarkablePath(kwargs=item))
            else:
                raise ValueError(f"ERROR: Invalid Item type in children:\t{type(item)}")


if __name__ == "__main__":
    rmt = RemarkableTemplate(f"{SRCDIR}/data/P Week 2.template")
    pprint(rmt.src_template)
